import sys
import os
import signal
import time
import logging
import re
from pathlib import Path
from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)



POLL_INTERVAL = 3
FLUSH_AFTER = 9

GENERIC_LABELS = {
    "captions",
    "turn on captions",
    "turn off captions",
    "captions are on",
    "captions are off",
}


def normalize_text(text):
    """Normalize whitespace for reliable caption comparisons."""
    return re.sub(r"\s+", " ", text or "").strip()


def get_caption_speaker(elements, By):
    """
    Try to identify the speaker from caption elements or nearby ancestors.
    Returns None when no reliable speaker label is exposed.
    """
    for element in elements:
        current = element

        for _ in range(5):
            for attr in ("data-speaker-name", "aria-label", "title"):
                try:
                    label = normalize_text(current.get_attribute(attr))
                    if (
                        label
                        and label.lower() not in GENERIC_LABELS
                        and len(label) <= 100
                    ):
                        return label
                except Exception:
                    pass

            try:
                current = current.find_element(By.XPATH, "..")
            except Exception:
                break

    return None


def get_new_text(previous, current):
    """
    Return only the new portion of a caption snapshot.
    Handles growing captions and overlapping revised snapshots.
    """
    previous = normalize_text(previous)
    current = normalize_text(current)

    if not current:
        return ""

    if not previous:
        return current

    if current == previous:
        return ""

    # Meet extended the existing caption.
    if current.startswith(previous):
        return current[len(previous):].strip()

    # The current snapshot is an older/shorter version.
    if previous.startswith(current):
        return ""

    # Handle partial overlap when the caption window changes.
    max_overlap = min(len(previous), len(current))

    for size in range(max_overlap, 0, -1):
        if previous[-size:] == current[:size]:
            return current[size:].strip()

    # No overlap detected; treat it as a new caption.
    return current

def main():
    if len(sys.argv) < 3:
        logger.error("Insufficient arguments: meet_link and output_path required")
        sys.exit(1)

    meet_link = sys.argv[1]
    output_path = Path(sys.argv[2])

    firefox_profile = settings.GOOGLE_BOT_FIREFOX_PROFILE or os.getenv("GOOGLE_BOT_FIREFOX_PROFILE")
    if not firefox_profile:
        logger.error("GOOGLE_BOT_FIREFOX_PROFILE environment variable is required")
        sys.exit(1)
    profile_path = Path(firefox_profile)
    if not profile_path.is_dir():
        logger.error(f"Firefox profile directory does not exist: {profile_path}")
        sys.exit(1)

    running = True

    def handle_signal(sig, frame):
        nonlocal running
        running = False
        logger.info(f"Received signal {sig}, shutting down bot")

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    try:
        from selenium import webdriver
        from selenium.webdriver.firefox.options import Options
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        from selenium.common.exceptions import WebDriverException

        options = Options()
        # Do NOT use headless; show visible window
        # options.add_argument("-headless")
        options.add_argument("-profile")
        options.add_argument(str(profile_path))

        driver = webdriver.Firefox(options=options)
        driver.get(meet_link)
        logger.info(f"Navigated to {meet_link}")

        # Wait for captions button and enable captions if possible
        try:
            # The captions button may have aria-label "Turn on captions"
            captions_button = WebDriverWait(driver, 30).until(
                EC.element_to_be_clickable(
                    (By.CSS_SELECTOR, "button[aria-label='Turn on captions']")
                )
            )
            captions_button.click()
            logger.info("Enabled captions via UI button")
        except Exception as e:
            logger.warning(f"Could not enable captions automatically: {e}")

        with output_path.open("a", encoding="utf-8") as f:
            pending_text = ""
            pending_speaker = None
            last_change_time = time.monotonic()
            last_snapshot = ""

            while running:
                time.sleep(POLL_INTERVAL)

                try:
                    caption_elems = driver.find_elements(
                        By.CSS_SELECTOR, "[aria-label='Captions'] .ygicle"
                    )

                    visible_parts = [
                        normalize_text(elem.text)
                        for elem in caption_elems
                        if normalize_text(elem.text)
                    ]
                    current_text = normalize_text(" ".join(visible_parts))
                    current_speaker = get_caption_speaker(caption_elems, By)

                    if not current_text:
                        # Flush pending text if captions disappear.
                        if pending_text and (
                            time.monotonic() - last_change_time >= FLUSH_AFTER
                        ):
                            line = (
                                f"{pending_speaker}: {pending_text}"
                                if pending_speaker
                                else pending_text
                            )
                            f.write(line + "\n")
                            f.flush()

                            pending_text = ""
                            pending_speaker = None
                            last_snapshot = ""

                        continue

                    now = time.monotonic()

                    # A speaker change finalizes the previous speaker's text.
                    if (
                        pending_text
                        and current_speaker
                        and pending_speaker
                        and current_speaker != pending_speaker
                    ):
                        line = (
                            f"{pending_speaker}: {pending_text}"
                            if pending_speaker
                            else pending_text
                        )
                        f.write(line + "\n")
                        f.flush()

                        pending_text = ""
                        last_snapshot = ""

                    # Avoid processing an identical caption snapshot repeatedly.
                    if current_text != last_snapshot:
                        new_text = get_new_text(last_snapshot, current_text)

                        if new_text:
                            if pending_text:
                                pending_text = normalize_text(
                                    pending_text + " " + new_text
                                )
                            else:
                                pending_text = new_text
                                pending_speaker = current_speaker

                            last_change_time = now

                        last_snapshot = current_text

                    # Flush the accumulated caption after 9 seconds of inactivity.
                    if (
                        pending_text
                        and now - last_change_time >= FLUSH_AFTER
                    ):
                        line = (
                            f"{pending_speaker}: {pending_text}"
                            if pending_speaker
                            else pending_text
                        )
                        f.write(line + "\n")
                        f.flush()

                        pending_text = ""
                        pending_speaker = None
                        last_snapshot = ""

                except WebDriverException as e:
                    logger.error(
                        "WebDriver session lost; stopping caption capture: %s", e
                    )
                    break

            # Preserve the final pending caption when the worker stops.
            if pending_text:
                line = (
                    f"{pending_speaker}: {pending_text}"
                    if pending_speaker
                    else pending_text
                )
                f.write(line + "\n")
                f.flush()
    except Exception as e:
        logger.exception("Unhandled exception in scraper worker")
        # Write a fallback line to transcript so stop_bot can return something
        with output_path.open("a", encoding="utf-8") as f:
            f.write(f"[Bot encountered error: {e}]\n")
            f.flush()
        # Keep process alive until signal so caller can stop it safely
        while running:
            time.sleep(0.5)
        # Ensure driver quits if it was created
        try:
            driver.quit()
        except Exception:
            pass

if __name__ == "__main__":
    main()
