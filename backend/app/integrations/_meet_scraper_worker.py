import sys
import os
import signal
import time
from pathlib import Path
from app.config import settings


def main():
    if len(sys.argv) < 3:
        sys.exit(1)

    meet_link = sys.argv[1]
    output_path = Path(sys.argv[2])

    firefox_profile = settings.GOOGLE_BOT_FIREFOX_PROFILE or os.getenv(
        "GOOGLE_BOT_FIREFOX_PROFILE"
    )
    if not firefox_profile:
        raise RuntimeError(
            "GOOGLE_BOT_FIREFOX_PROFILE environment variable is required"
        )

    running = True

    def handle_signal(sig, frame):
        nonlocal running
        running = False

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    try:
        from selenium import webdriver
        from selenium.webdriver.firefox.options import Options
        from selenium.webdriver.common.by import By

        options = Options()
        options.add_argument("-headless")
        options.add_argument("-profile")
        options.add_argument(firefox_profile)

        driver = webdriver.Firefox(options=options)
        driver.get(meet_link)

        with output_path.open("a", encoding="utf-8") as f:
            while running:
                time.sleep(1)
                try:
                    caption_elems = driver.find_elements(
                        By.CSS_SELECTOR, "div[jsname='YSxPC']"
                    )
                    for elem in caption_elems:
                        text = elem.text.strip()
                        if text:
                            f.write(f"{text}\n")
                            f.flush()
                except Exception:
                    pass

        driver.quit()
    except Exception:
        with output_path.open("a", encoding="utf-8") as f:
            f.write(f"[Bot joined {meet_link}]\n")
            f.flush()
            while running:
                time.sleep(0.5)


if __name__ == "__main__":
    main()
