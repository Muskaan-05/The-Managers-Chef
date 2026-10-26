import os
import signal
import sys
from pathlib import Path
from unittest.mock import MagicMock
import pytest

from app.integrations.google_meet_scraper import (
    is_process_running,
    start_bot,
    stop_bot,
    BACKEND_DIR,
    TRANSCRIPTS_DIR,
)


def test_is_process_running():
    # Current running process must be detected as running
    assert is_process_running(os.getpid()) is True

    # Dead/invalid PIDs must be False
    assert is_process_running(None) is False
    assert is_process_running(0) is False
    assert is_process_running(-1) is False
    assert is_process_running(99999999) is False


def test_start_bot_launches_module_with_correct_env(monkeypatch, tmp_path):
    mock_popen = MagicMock()
    mock_process = MagicMock()
    mock_process.pid = 4321
    mock_process.poll.return_value = None  # Process is running
    mock_popen.return_value = mock_process

    monkeypatch.setattr("subprocess.Popen", mock_popen)
    monkeypatch.setattr("app.integrations.google_meet_scraper.TRANSCRIPTS_DIR", tmp_path)

    meet_url = "https://meet.google.com/test-abc-xyz"
    meeting_id = "test-meeting-uuid"

    res = start_bot(meet_link=meet_url, meeting_id=meeting_id)

    assert res["process_id"] == 4321
    assert res["transcript_path"] == str(tmp_path / f"{meeting_id}.txt")

    mock_popen.assert_called_once()
    args, kwargs = mock_popen.call_args

    cmd = args[0]
    # Check that it runs as module (-m app.integrations._meet_scraper_worker)
    assert cmd[0] == sys.executable
    assert cmd[1] == "-u"
    assert cmd[2] == "-m"
    assert cmd[3] == "app.integrations._meet_scraper_worker"
    assert cmd[4] == meet_url
    assert cmd[5] == str(tmp_path / f"{meeting_id}.txt")

    # Check working directory and PYTHONPATH
    assert kwargs["cwd"] == str(BACKEND_DIR)
    assert kwargs["env"]["PYTHONPATH"] == str(BACKEND_DIR)
    assert kwargs["stdout"] is None
    assert kwargs["stderr"] is None


def test_start_bot_immediate_failure_raises(monkeypatch, tmp_path):
    mock_popen = MagicMock()
    mock_process = MagicMock()
    mock_process.pid = 4321
    mock_process.poll.return_value = 1  # Process crashed on startup
    mock_process.returncode = 1
    mock_popen.return_value = mock_process

    monkeypatch.setattr("subprocess.Popen", mock_popen)
    monkeypatch.setattr("app.integrations.google_meet_scraper.TRANSCRIPTS_DIR", tmp_path)

    with pytest.raises(RuntimeError) as exc_info:
        start_bot(meet_link="https://meet.google.com/fail", meeting_id="fail-id")

    assert "exited immediately with code 1" in str(exc_info.value)


def test_stop_bot_reads_transcript(tmp_path):
    t_file = tmp_path / "meeting_done.txt"
    t_file.write_text("[2026-10-26 10:00:00] Hello team\n[2026-10-26 10:00:05] Let us begin")

    content = stop_bot(process_id=None, transcript_path=str(t_file))
    assert content is not None
    assert "Hello team" in content
    assert "Let us begin" in content


def test_stop_bot_missing_transcript(tmp_path):
    t_file = tmp_path / "nonexistent.txt"
    content = stop_bot(process_id=None, transcript_path=str(t_file))
    assert content is None

