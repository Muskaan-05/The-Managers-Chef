import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional

# Root directory of backend (contains 'app' package)
BACKEND_DIR = Path(__file__).resolve().parents[2]
TRANSCRIPTS_DIR = BACKEND_DIR / "meeting_transcripts"
TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)


def is_process_running(pid: Optional[int]) -> bool:
    """Check if a process with given PID is currently alive."""
    if not pid or pid <= 0:
        return False
    try:
        waited_pid, _ = os.waitpid(pid, os.WNOHANG)
        if waited_pid == pid:
            return False
    except ChildProcessError:
        pass
    except OSError:
        pass

    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def start_bot(meet_link: str, meeting_id: str) -> Dict[str, Any]:
    """Launch the Selenium worker for a meeting using module execution.
    Runs 'python -u -m app.integrations._meet_scraper_worker' with cwd=BACKEND_DIR
    so app.config and backend/.env are loaded correctly.
    Returns the process PID and the path to the transcript file.
    """
    output_path = TRANSCRIPTS_DIR / f"{meeting_id}.txt"
    env = {**os.environ, "PYTHONPATH": str(BACKEND_DIR)}

    # Stream logs directly to terminal so they are visible in backend logs;
    # Avoid subprocess.PIPE which can deadlock when the buffer fills up.
    process = subprocess.Popen(
        [sys.executable, "-u", "-m", "app.integrations._meet_scraper_worker", meet_link, str(output_path)],
        cwd=str(BACKEND_DIR),
        env=env,
        stdout=None,
        stderr=None,
    )

    # Check if process exited immediately on startup error
    time.sleep(0.1)
    if process.poll() is not None:
        raise RuntimeError(f"Scraper worker exited immediately with code {process.returncode}")

    return {"process_id": process.pid, "transcript_path": str(output_path)}


def stop_bot(process_id: Optional[int] = None, transcript_path: Optional[str] = None) -> Optional[str]:
    """Stop the bot worker process and read the final transcript file."""
    if process_id and is_process_running(process_id):
        try:
            os.kill(process_id, signal.SIGINT)
        except (ProcessLookupError, PermissionError):
            pass

    if transcript_path:
        path = Path(transcript_path)
        # Give the worker a moment to flush final captions and shut down
        for _ in range(10):
            if path.exists() and path.stat().st_size > 0:
                break
            time.sleep(0.1)
        if path.exists():
            content = path.read_text(encoding="utf-8").strip()
            return content if content else None

    return None

