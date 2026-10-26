import sys
import os
import signal
import time
import logging
from pathlib import Path
from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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
            previous_texts = set()
            last_caption = ""

            while running:
                time.sleep(1)

                try:
                    caption_elems = driver.find_elements(
                        By.CSS_SELECTOR, "[aria-label='Captions'] .ygicle"
                    )

                    current_text = " ".join(
                        elem.text.strip()
                        for elem in caption_elems
                        if elem.text.strip()
                    ).strip()

                    if current_text and current_text != last_caption:
                        if current_text.startswith(last_caption):
                            # Save only the newly added portion.
                            new_text = current_text[len(last_caption):].strip()
                        else:
                            # Caption changed or a new caption replaced the old one.
                            new_text = current_text

                        if new_text:
                            timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
                            f.write(f"[{timestamp}] {new_text}\n")
                            f.flush()

                        last_caption = current_text

                except WebDriverException as e:
                    logger.error(
                        "WebDriver session lost; stopping caption capture: %s", e
                    )
                    break
        driver.quit()
        logger.info("Browser closed, bot exiting gracefully")
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
