from pathlib import Path
from johnmamapdfv2.paths import WEB_DIR


def get_theme_css_path() -> Path:
    """Returns path to the active theme CSS file."""
    return WEB_DIR / "css" / "theme.css"
