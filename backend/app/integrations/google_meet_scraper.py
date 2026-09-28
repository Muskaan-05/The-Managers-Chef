import subprocess
import sys
import signal
import os
from pathlib import Path
from typing import Optional, Dict, Any

TRANSCRIPTS_DIR = Path("meeting_transcripts")
TRANSCRIPTS_DIR.mkdir(exist_ok=True)


def start_bot(meet_link: str, meeting_id: str) -> Dict[str, Any]:
    output_path = TRANSCRIPTS_DIR / f"{meeting_id}.txt"
    worker_script = Path(__file__).parent / "_meet_scraper_worker.py"
    process = subprocess.Popen(
        [sys.executable, str(worker_script), meet_link, str(output_path)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return {"process_id": process.pid, "transcript_path": str(output_path)}


def stop_bot(process_id: int, transcript_path: str) -> Optional[str]:
    try:
        os.kill(process_id, signal.SIGINT)
    except (ProcessLookupError, PermissionError):
        pass
    path = Path(transcript_path)
    if path.exists():
        content = path.read_text(encoding="utf-8").strip()
        return content if content else None
    return None
