import sys
from pathlib import Path

def get_bundle_dir() -> Path:
    """
    Returns the root directory where bundled assets live.
    - PyInstaller onefile: sys._MEIPASS
    - Running from source: points to src/johnmamapdfv2
    """
    if getattr(sys, "frozen", False):
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        meipass = getattr(sys, "_MEIPASS", None)
        if meipass is not None:
            return Path(str(meipass))
        return Path(sys.executable).parent
    return Path(__file__).resolve().parent


# --- Static Internal Paths (Read-Only Bundle) ---
BUNDLE_DIR = get_bundle_dir()

# If PyInstaller collects everything under your package folder or flat at root:
ASSETS_DIR = (
    BUNDLE_DIR / "src" / "johnmamapdfv2" / "assets"
    if (BUNDLE_DIR / "src" / "johnmamapdfv2" / "assets").exists()
    else BUNDLE_DIR / "assets"
)

WEB_DIR = (
    BUNDLE_DIR / "src" / "johnmamapdfv2" / "web"
    if (BUNDLE_DIR / "src" / "johnmamapdfv2" / "web").exists()
    else BUNDLE_DIR / "web"
)

CERTIFICATE_TEMPLATE = ASSETS_DIR / "certyfikat.typ"
ATTENDANCE_TEMPLATE = ASSETS_DIR / "lista_obecnosci.typ"


# --- User Workspace Paths (Read/Write Storage) ---
def get_workspace_dir() -> Path:
    """User data directory in Documents. Never write into BUNDLE_DIR."""
    path = Path.home() / "Documents" / "GeneratorZaswiadczen"
    path.mkdir(parents=True, exist_ok=True)
    return path
