import os
import sys
import json
import urllib.request
import urllib.error
import subprocess
import hashlib
import zipfile
import shutil
import stat
import threading

# Attempt to load Tkinter for the GUI splash screen
try:
    import tkinter as tk
    from tkinter import font
    HAS_TKINTER = True
except ImportError:
    HAS_TKINTER = False

# --- CONFIGURATION ---
TEST_MODE = False
GITHUB_REPO = "JohnEggz/JohnOdsToPdf" 

if sys.platform == "win32":
    BASE_DIR = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "GeneratorZaswiadczen")
    EXE_NAME = "GeneratorZaswiadczen.exe"
    ZIP_NAME = "GeneratorZaswiadczen-Windows.zip"
else:
    BASE_DIR = os.path.join(os.path.expanduser("~"), ".local", "share", "GeneratorZaswiadczen")
    EXE_NAME = "GeneratorZaswiadczen"
    ZIP_NAME = "GeneratorZaswiadczen-Linux.zip"

os.makedirs(BASE_DIR, exist_ok=True)

VERSION_FILE = os.path.join(BASE_DIR, "version.txt")
ZIP_PATH = os.path.join(BASE_DIR, ZIP_NAME)
SHA_PATH = os.path.join(BASE_DIR, f"{ZIP_NAME}.sha256")
APP_DIR = os.path.join(BASE_DIR, "GeneratorZaswiadczen")
EXE_PATH = os.path.join(APP_DIR, EXE_NAME)

def get_local_version():
    if os.path.exists(VERSION_FILE):
        with open(VERSION_FILE, "r") as f:
            return f.read().strip()
    return "v0.0.0"

def set_local_version(version):
    with open(VERSION_FILE, "w") as f:
        f.write(version)

def download_file(url, dest, update_ui_status):
    update_ui_status(f"Pobieranie aktualizacji...")
    req = urllib.request.Request(url, headers={"User-Agent": "Auto-Updater"})
    with urllib.request.urlopen(req, timeout=10) as response, open(dest, 'wb') as out_file:
        shutil.copyfileobj(response, out_file)

def verify_sha256(file_path, expected_hash_path):
    with open(expected_hash_path, "r") as f:
        expected_hash = f.read().strip().split()[0].lower()
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest().lower() == expected_hash

def launch_app(root=None):
    if os.path.exists(EXE_PATH):
        if sys.platform == "win32":
            subprocess.Popen([EXE_PATH], creationflags=subprocess.DETACHED_PROCESS, cwd=APP_DIR)
        else:
            subprocess.Popen([EXE_PATH], start_new_session=True, cwd=APP_DIR)
    else:
        print("Błąd: Nie znaleziono aplikacji do uruchomienia.")
        
    if root:
        root.after(0, root.destroy)

def core_update_logic(update_ui_callback, on_complete_callback):
    """The main updater logic decoupled from the UI."""
    update_ui_callback("Sprawdzanie aktualizacji...")
    local_version = get_local_version()

    if TEST_MODE:
        url = "http://localhost:8000/release.json"
    else:
        url = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"

    req = urllib.request.Request(url, headers={"User-Agent": "Auto-Updater"})
    
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            release = json.loads(response.read().decode('utf-8'))
    except (urllib.error.URLError, Exception):
        update_ui_callback("Brak połączenia. Uruchamianie...")
        on_complete_callback()
        return

    latest_version = release.get("tag_name", "v0.0.0")
    if latest_version <= local_version and os.path.exists(EXE_PATH):
        update_ui_callback("Aplikacja jest aktualna. Uruchamianie...")
        on_complete_callback()
        return

    update_ui_callback(f"Znaleziono nową wersję: {latest_version}")
    
    if TEST_MODE:
        zip_url = f"http://localhost:8000/{ZIP_NAME}"
        sha_url = f"http://localhost:8000/{ZIP_NAME}.sha256"
    else:
        zip_url, sha_url = None, None
        for asset in release.get("assets", []):
            if asset["name"] == ZIP_NAME: zip_url = asset["browser_download_url"]
            elif asset["name"] == f"{ZIP_NAME}.sha256": sha_url = asset["browser_download_url"]

    if zip_url and sha_url:
        try:
            download_file(zip_url, ZIP_PATH, update_ui_callback)
            download_file(sha_url, SHA_PATH, update_ui_callback)

            update_ui_callback("Weryfikacja plików...")
            if verify_sha256(ZIP_PATH, SHA_PATH):
                update_ui_callback("Instalowanie aktualizacji...")
                if os.path.exists(APP_DIR):
                    shutil.rmtree(APP_DIR)
                with zipfile.ZipFile(ZIP_PATH, 'r') as zip_ref:
                    zip_ref.extractall(BASE_DIR)
                if sys.platform != "win32" and os.path.exists(EXE_PATH):
                    st = os.stat(EXE_PATH)
                    os.chmod(EXE_PATH, st.st_mode | stat.S_IEXEC)
                set_local_version(latest_version)
                update_ui_callback("Gotowe! Uruchamianie...")
            else:
                update_ui_callback("Błąd: Uszkodzony plik. Uruchamianie starej wersji...")
        except Exception as e:
            update_ui_callback(f"Wystąpił błąd: {e}")
        finally:
            if os.path.exists(ZIP_PATH): os.remove(ZIP_PATH)
            if os.path.exists(SHA_PATH): os.remove(SHA_PATH)
    else:
        update_ui_callback("Brak plików na serwerze.")

    on_complete_callback()


def run_gui_updater():
    """Runs the updater with the Tkinter splash screen."""
    root = tk.Tk()
    root.overrideredirect(True)
    
    window_width = 350
    window_height = 120
    screen_width = root.winfo_screenwidth()
    screen_height = root.winfo_screenheight()
    x = int((screen_width / 2) - (window_width / 2))
    y = int((screen_height / 2) - (window_height / 2))
    root.geometry(f"{window_width}x{window_height}+{x}+{y}")
    
    root.configure(bg="#4f46e5")
    status_var = tk.StringVar(value="Inicjalizacja...")

    title_font = font.Font(family="Helvetica", size=14, weight="bold")
    status_font = font.Font(family="Helvetica", size=10)
    
    tk.Label(root, text="Generator Zaświadczeń", fg="white", bg="#4f46e5", font=title_font).pack(pady=(25, 5))
    tk.Label(root, textvariable=status_var, fg="#c7d2fe", bg="#4f46e5", font=status_font).pack()

    def ui_callback(msg):
        root.after(0, lambda: status_var.set(msg))
        
    def complete_callback():
        root.after(1000, lambda: launch_app(root))

    threading.Thread(target=core_update_logic, args=(ui_callback, complete_callback), daemon=True).start()
    root.mainloop()

def run_cli_updater():
    """Fallback terminal updater for Linux missing Tkinter libs."""
    print("="*40)
    print(" Generator Zaświadczeń - Updater")
    print("="*40)
    
    def ui_callback(msg):
        print(f"[*] {msg}")
        
    def complete_callback():
        launch_app()
        
    core_update_logic(ui_callback, complete_callback)


if __name__ == "__main__":
    if HAS_TKINTER:
        run_gui_updater()
    else:
        run_cli_updater()
