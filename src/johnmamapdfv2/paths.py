import os
import sys
from pathlib import Path


def get_bundle_dir() -> Path:
    """
    Returns the root directory where bundled assets live.
    - PyInstaller onefile: sys._MEIPASS
    - Running from source: points to src/johnmamapdfv2
    """
    if getattr(sys, "frozen", False):
        meipass = getattr(sys, "_MEIPASS", None)
        if meipass is not None:
            return Path(str(meipass)).resolve()
        return Path(sys.executable).parent.resolve()
    return Path(__file__).resolve().parent


# --- Static Internal Paths (Read-Only Bundle) ---
BUNDLE_DIR = get_bundle_dir()

# Handle source tree vs PyInstaller bundled flat tree
def _resolve_resource_dir(name: str) -> Path:
    candidates = [
        BUNDLE_DIR / name,
        BUNDLE_DIR / "src" / "johnmamapdfv2" / name,
        BUNDLE_DIR / "johnmamapdfv2" / name,
    ]
    for p in candidates:
        if p.exists():
            return p.resolve()
    # Fallback to local sibling directory
    return (BUNDLE_DIR / name).resolve()


ASSETS_DIR = _resolve_resource_dir("assets")
WEB_DIR = _resolve_resource_dir("web")

CERTIFICATE_TEMPLATE = ASSETS_DIR / "certyfikat.typ"
ATTENDANCE_TEMPLATE = ASSETS_DIR / "lista_obecnosci.typ"


# --- Windows-Safe User Workspace Paths ---
def get_documents_dir() -> Path:
    """Resolves true user Documents folder, respecting Windows OneDrive redirection."""
    if sys.platform == "win32":
        try:
            import ctypes.wintypes
            # CSIDL_PERSONAL = 0x0005 (My Documents)
            # SHGFP_TYPE_CURRENT = 0
            buf = ctypes.create_unicode_buffer(ctypes.wintypes.MAX_PATH)
            ctypes.windll.shell32.SHGetFolderPathW(None, 5, None, 0, buf)
            if buf.value:
                return Path(buf.value)
        except Exception:
            pass

    # Standard fallback for Linux/macOS and non-standard environments
    return Path.home() / "Documents"


def get_workspace_dir() -> Path:
    """User data directory in Documents. Creates path lazily on demand."""
    path = get_documents_dir() / "GeneratorZaswiadczen"
    path.mkdir(parents=True, exist_ok=True)
    return path.resolve()


def get_app_data_dir() -> Path:
    """
    Persistent application internal state (cache, temp files, db).
    Windows: %LOCALAPPDATA%/GeneratorZaswiadczen
    Linux: ~/.local/share/GeneratorZaswiadczen
    """
    if sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))

    path = base / "GeneratorZaswiadczen"
    path.mkdir(parents=True, exist_ok=True)
    return path.resolve()
