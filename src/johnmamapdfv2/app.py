import sys
import shutil
import eel
from johnmamapdfv2.paths import WEB_DIR, get_workspace_dir
# Importing api registers all @eel.expose functions
import johnmamapdfv2.api  # noqa: F401


def run() -> None:
    """Entry point for the JohnMamaPDF v2 Eel application."""
    # Ensure workspace directory exists
    get_workspace_dir()

    # Initialize Eel with the static web directory
    eel.init(str(WEB_DIR))

    # Detect best available browser mode
    mode = "chrome"
    has_chromium = any(
        shutil.which(cmd)
        for cmd in (
            "google-chrome",
            "google-chrome-stable",
            "chromium",
            "chromium-browser",
            "brave",
            "brave-browser",
        )
    )
    if not has_chromium and sys.platform.startswith("linux"):
        mode = "default"

    # Start Eel desktop interface
    try:
        eel.start(
            "index.html",
            mode=mode,
            size=(1400, 880),
            cmdline_args=["--start-maximized"],
            port=0,  # Picks an available free port automatically
        )
    except (SystemExit, KeyboardInterrupt):
        pass
    except Exception as exc:
        print(f"Error launching browser in mode '{mode}': {exc}. Falling back to default browser...")
        try:
            eel.start("index.html", mode="default", port=0)
        except (SystemExit, KeyboardInterrupt):
            pass


if __name__ == "__main__":
    run()
