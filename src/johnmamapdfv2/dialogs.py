import shutil
import subprocess
from pathlib import Path
import sys


def _pick_file_zenity(title: str, file_filters: list[tuple[str, str]]) -> Path | None:
    """Uses zenity to pick a file."""
    zenity_bin = shutil.which("zenity")
    if not zenity_bin:
        return None

    cmd = [zenity_bin, "--file-selection", f"--title={title}"]
    for filter_name, pattern in file_filters:
        cmd.append(f"--file-filter={filter_name} | {pattern}")

    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if res.returncode == 0:
            selected = res.stdout.strip()
            if selected:
                return Path(selected)
        return None
    except Exception:
        return None


def _pick_file_tkinter(title: str, file_types: list[tuple[str, str]]) -> Path | None:
    """Fallback file picker using tkinter."""
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        selected = filedialog.askopenfilename(title=title, filetypes=file_types)
        root.destroy()
        if selected:
            return Path(selected)
        return None
    except Exception:
        return None


def pick_spreadsheet_file() -> Path | None:
    """Opens native dialog for selecting spreadsheet (.ods, .xlsx, .xls)."""
    filters_zenity = [
        ("Arkusze kalkulacyjne (*.ods, *.xlsx)", "*.ods *.xlsx *.ODS *.XLSX"),
        ("Wszystkie pliki", "*"),
    ]
    filters_tk = [
        ("Arkusze kalkulacyjne (*.ods, *.xlsx)", "*.ods *.xlsx *.ODS *.XLSX"),
        ("Wszystkie pliki", "*.*"),
    ]

    path = _pick_file_zenity("Wybierz arkusz (.ods / .xlsx)", filters_zenity)
    if path is not None:
        return path
    if shutil.which("zenity"):
        # Zenity was present, user cancelled
        return None
    return _pick_file_tkinter("Wybierz arkusz (.ods / .xlsx)", filters_tk)


def pick_json_file() -> Path | None:
    """Opens native dialog for selecting JSON document."""
    filters_zenity = [
        ("Pliki JSON (*.json)", "*.json *.JSON"),
        ("Wszystkie pliki", "*"),
    ]
    filters_tk = [
        ("Pliki JSON (*.json)", "*.json"),
        ("Wszystkie pliki", "*.*"),
    ]

    path = _pick_file_zenity("Wybierz plik projektu (.json)", filters_zenity)
    if path is not None:
        return path
    if shutil.which("zenity"):
        return None
    return _pick_file_tkinter("Wybierz plik projektu (.json)", filters_tk)


def pick_save_json_file(default_filename: str = "szkolenie.json") -> Path | None:
    """Opens native dialog for saving JSON document."""
    zenity_bin = shutil.which("zenity")
    if zenity_bin:
        cmd = [
            zenity_bin,
            "--file-selection",
            "--save",
            "--confirm-overwrite",
            "--title=Zapisz projekt jako JSON",
            f"--filename={default_filename}",
            "--file-filter=Pliki JSON (*.json) | *.json",
        ]
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if res.returncode == 0 and res.stdout.strip():
                return Path(res.stdout.strip())
            return None
        except Exception:
            pass

    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        selected = filedialog.asksaveasfilename(
            title="Zapisz projekt jako JSON",
            initialfile=default_filename,
            defaultextension=".json",
            filetypes=[("Pliki JSON (*.json)", "*.json"), ("Wszystkie pliki", "*.*")],
        )
        root.destroy()
        if selected:
            return Path(selected)
    except Exception:
        pass
    return None


def open_in_file_manager(target_path: Path | str) -> bool:
    """Opens the target directory or file's parent in the OS default file manager."""
    path = Path(target_path).resolve()
    if path.is_file():
        path = path.parent

    path.mkdir(parents=True, exist_ok=True)

    try:
        if sys.platform == "linux":
            opener = shutil.which("xdg-open") or shutil.which("gio")
            if opener:
                subprocess.Popen([opener, str(path)])
                return True
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(path)])
            return True
        elif sys.platform == "win32":
            subprocess.Popen(["explorer", str(path)])
            return True
    except Exception:
        return False
    return False
