from datetime import datetime
import json
from pathlib import Path
import re
from typing import Any
from johnmamapdfv2.paths import get_workspace_dir


def sanitize_project_name(name: str) -> str:
    """Sanitizes a string to be a valid folder name on Linux/Windows."""
    cleaned = re.sub(r'[\\/*?:"<>|]', "_", name).strip()
    return cleaned or "nowy_projekt"


def create_project_directory(base_name: str) -> Path:
    """
    Creates a new project directory in the user workspace.
    Guarantees a unique directory for each new ODS import.
    """
    workspace = get_workspace_dir()
    clean_base = sanitize_project_name(base_name)
    target_dir = workspace / clean_base

    if not target_dir.exists():
        target_dir.mkdir(parents=True, exist_ok=True)
        return target_dir

    # If it exists, append timestamp to make it unique
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    target_dir = workspace / f"{clean_base}_{timestamp}"
    target_dir.mkdir(parents=True, exist_ok=True)
    return target_dir


def list_workspace_projects() -> list[dict[str, Any]]:
    """
    Scans the user workspace directory for project directories.
    Returns a list of project summaries sorted by modification time descending.
    """
    workspace = get_workspace_dir()
    projects: list[dict[str, Any]] = []

    try:
        for item in workspace.iterdir():
            if item.name.startswith("."):
                continue

            if item.is_dir():
                json_files = list(item.glob("*.json"))
                pdf_files = list(item.glob("*.pdf"))
                mtime = item.stat().st_mtime

                doc_file = item / "szkolenie.json"
                if not doc_file.exists() and json_files:
                    doc_file = json_files[0]

                sub_count = 0
                title = item.name

                if doc_file and doc_file.exists():
                    try:
                        data = json.loads(doc_file.read_text(encoding="utf-8"))
                        if isinstance(data, dict):
                            t = data.get("training", {})
                            if isinstance(t, dict) and t.get("nazwa_szkolenia"):
                                title = str(t["nazwa_szkolenia"])
                            sub_count = len(data.get("participants", []))
                    except Exception:
                        pass

                has_cert = (item / "certyfikaty.pdf").exists()
                has_attendance = (item / "lista_obecnosci.pdf").exists()

                projects.append({
                    "name": item.name,
                    "title": title,
                    "path": str(item),
                    "json_file": str(doc_file) if doc_file.exists() else None,
                    "pdf_count": len(pdf_files),
                    "has_cert": has_cert,
                    "has_attendance": has_attendance,
                    "participant_count": sub_count,
                    "mtime": mtime,
                    "modified": datetime.fromtimestamp(mtime).strftime("%d.%m.%Y %H:%M"),
                })

    except Exception:
        pass

    projects.sort(key=lambda x: x["mtime"], reverse=True)
    return projects
