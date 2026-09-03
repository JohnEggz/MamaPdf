import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import threading
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

# Attempt Tkinter GUI splash, fallback to CLI
try:
    import tkinter as tk
    from tkinter import font
    HAS_TKINTER = True
except ImportError:
    HAS_TKINTER = False

# --- CONFIGURATION ---
GITHUB_REPO = "JohnEggz/MamaPdf"
APP_NAME = "GeneratorZaswiadczen"

if sys.platform == "win32":
    EXE_NAME = f"{APP_NAME}.exe"
    ZIP_NAME = f"{APP_NAME}-Windows.zip"
    BASE_DIR = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / APP_NAME
else:
    EXE_NAME = APP_NAME
    ZIP_NAME = f"{APP_NAME}-Linux.zip"
    BASE_DIR = Path.home() / ".local" / "share" / APP_NAME

VERSION_FILE = BASE_DIR / "version.txt"
APP_DIR = BASE_DIR / APP_NAME
EXE_PATH = APP_DIR / EXE_NAME


# --- VERSION COMPARISON ---
def parse_version(tag: str) -> tuple[int, ...]:
    """Converts a semantic version tag (e.g., 'v1.2.3') into a comparable tuple of ints."""
    clean = re.sub(r"^[^\d]*", "", tag.strip())
    tokens = re.split(r"[.\-+]", clean)
    nums = []
    for token in tokens:
        if token.isdigit():
            nums.append(int(token))
        else:
            break
    return tuple(nums) if nums else (0, 0, 0)


def get_local_version() -> str:
    if VERSION_FILE.is_file():
        try:
            return VERSION_FILE.read_text(encoding="utf-8").strip()
        except OSError:
            pass
    return "v0.0.0"


def set_local_version(tag: str) -> None:
    VERSION_FILE.parent.mkdir(parents=True, exist_ok=True)
    VERSION_FILE.write_text(tag, encoding="utf-8")


# --- NETWORK & VERIFICATION ---
def get_latest_release_tag() -> str | None:
    """Fetches the latest release tag via GitHub REST API."""
    url = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": f"{APP_NAME}-Launcher",
            "Accept": "application/vnd.github.v3+json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("tag_name")
    except Exception as e:
        print(f"Error fetching release: {e}")
        return None


def download_stream(url: str, dest: Path, status_cb, chunk_size: int = 65536) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": f"{APP_NAME}-Launcher"})
    with urllib.request.urlopen(req, timeout=15) as response, open(dest, "wb") as out_file:
        while chunk := response.read(chunk_size):
            out_file.write(chunk)


def verify_sha256(file_path: Path, expected_hash_file: Path) -> bool:
    expected = expected_hash_file.read_text(encoding="utf-8").strip().split()[0].lower()
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest().lower() == expected


# --- APPLICATION LAUNCHER ---
def launch_app(root: tk.Tk | None = None) -> None:
    if EXE_PATH.is_file():
        if sys.platform == "win32":
            subprocess.Popen(
                [str(EXE_PATH)],
                creationflags=subprocess.DETACHED_PROCESS,
                cwd=str(APP_DIR),
                close_fds=True,
            )
        else:
            subprocess.Popen(
                [str(EXE_PATH)],
                start_new_session=True,
                cwd=str(APP_DIR),
            )
    else:
        print(f"Error: Target executable not found at {EXE_PATH}")

    if root:
        root.after(0, root.destroy)


# --- ATOMIC UPDATE PIPELINE ---
def perform_update(tag: str, status_cb) -> bool:
    """Safely downloads, unpacks, and replaces the application directory."""
    download_base = f"https://github.com/{GITHUB_REPO}/releases/download/{tag}"
    zip_url = f"{download_base}/{ZIP_NAME}"
    sha_url = f"{download_base}/{ZIP_NAME}.sha256"

    BASE_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=BASE_DIR) as tmp_dir_str:
        tmp_dir = Path(tmp_dir_str)
        zip_dest = tmp_dir / ZIP_NAME
        sha_dest = tmp_dir / f"{ZIP_NAME}.sha256"
        staging_dir = tmp_dir / "staged"

        status_cb("Pobieranie plików...")
        try:
            download_stream(zip_url, zip_dest, status_cb)
            download_stream(sha_url, sha_dest, status_cb)
        except Exception as e:
            status_cb(f"Błąd pobierania: {e}")
            return False

        status_cb("Weryfikacja sumy kontrolnej...")
        try:
            if not verify_sha256(zip_dest, sha_dest):
                status_cb("Błąd: Uszkodzona suma kontrolna SHA256.")
                return False
        except Exception as e:
            status_cb(f"Błąd weryfikacji: {e}")
            return False

        status_cb("Wypakowywanie...")
        try:
            with zipfile.ZipFile(zip_dest, "r") as zf:
                zf.extractall(staging_dir)
        except Exception as e:
            status_cb(f"Błąd rozpakowywania: {e}")
            return False

        # Locate the directory containing the executable payload
        extracted_exe = [f for f in staging_dir.rglob(EXE_NAME) if f.is_file()]
        if not extracted_exe:
            status_cb("Błąd: Archiwum nie zawiera pliku wykonywalnego.")
            return False
        exe_file = extracted_exe[0]
        extracted_root = exe_file.parent

        status_cb("Instalowanie...")
        backup_dir = BASE_DIR / f"{APP_NAME}_backup"
        try:
            if backup_dir.exists():
                shutil.rmtree(backup_dir, ignore_errors=True)

            if APP_DIR.exists():
                APP_DIR.rename(backup_dir)

            # Copy tree directly into APP_DIR to prevent path nesting issues
            shutil.copytree(extracted_root, APP_DIR, dirs_exist_ok=True)

            if sys.platform != "win32":
                final_exe = APP_DIR / EXE_NAME
                if final_exe.is_file():
                    final_exe.chmod(final_exe.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

            set_local_version(tag)

            if backup_dir.exists():
                shutil.rmtree(backup_dir, ignore_errors=True)
            return True

        except Exception as e:
            status_cb("Przywracanie poprzedniej wersji...")
            if backup_dir.exists() and not APP_DIR.exists():
                backup_dir.rename(APP_DIR)
            status_cb(f"Błąd instalacji: {e}")
            return False


# --- CONTROLLER ---
def update_and_launch(status_cb, on_complete):
    status_cb("Sprawdzanie aktualizacji...")
    local_tag = get_local_version()
    latest_tag = get_latest_release_tag()

    needs_update = False
    if latest_tag:
        if parse_version(latest_tag) > parse_version(local_tag) or not EXE_PATH.is_file():
            needs_update = True

    if needs_update and latest_tag:
        status_cb(f"Aktualizacja do {latest_tag}...")
        success = perform_update(latest_tag, status_cb)
        if success:
            status_cb("Ukończono! Uruchamianie...")
        else:
            if EXE_PATH.is_file():
                status_cb("Uruchamianie wersji lokalnej...")
            else:
                status_cb("Błąd instalacji.")
    else:
        if EXE_PATH.is_file():
            status_cb("Aplikacja aktualna. Uruchamianie...")
        else:
            status_cb("Błąd: Nie znaleziono aplikacji ani aktualizacji.")

    on_complete()


# --- UI RUNNERS ---
def run_gui():
    root = tk.Tk()
    root.overrideredirect(True)

    width, height = 360, 110
    sw = root.winfo_screenwidth()
    sh = root.winfo_screenheight()
    x = (sw - width) // 2
    y = (sh - height) // 2
    root.geometry(f"{width}x{height}+{x}+{y}")
    root.configure(bg="#1e1e2e")

    status_var = tk.StringVar(value="Ładowanie...")
    f_title = font.Font(family="Segoe UI" if sys.platform == "win32" else "Helvetica", size=13, weight="bold")
    f_status = font.Font(family="Segoe UI" if sys.platform == "win32" else "Helvetica", size=9)

    tk.Label(root, text="Generator Zaświadczeń", fg="#cdd6f4", bg="#1e1e2e", font=f_title).pack(pady=(20, 4))
    tk.Label(root, textvariable=status_var, fg="#a6adc8", bg="#1e1e2e", font=f_status).pack()

    def ui_callback(msg: str):
        root.after(0, lambda: status_var.set(msg))

    def complete_callback():
        if EXE_PATH.is_file():
            root.after(700, lambda: launch_app(root))
        else:
            root.after(3000, root.destroy)

    threading.Thread(
        target=update_and_launch,
        args=(ui_callback, complete_callback),
        daemon=True,
    ).start()

    root.mainloop()


def run_cli():
    print("=" * 40)
    print(f" {APP_NAME} - Launcher")
    print("=" * 40)

    def ui_callback(msg: str):
        print(f"[*] {msg}")

    def complete_callback():
        launch_app()

    update_and_launch(ui_callback, complete_callback)


def main():
    if HAS_TKINTER:
        run_gui()
    else:
        run_cli()


if __name__ == "__main__":
    main()
