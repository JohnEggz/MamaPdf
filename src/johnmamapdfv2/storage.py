from datetime import datetime
import json
from pathlib import Path
import re
from typing import Any
from johnmamapdfv2.paths import get_workspace_dir


_INVALID_FILENAME_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
_WINDOWS_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}


def sanitize_filename_component(text: str) -> str:
    """Sanitizes a single path component (file name segment) for Linux/Windows."""
    cleaned = _INVALID_FILENAME_CHARS.sub("_", str(text))
    cleaned = re.sub(r"\s+", "_", cleaned)
    cleaned = cleaned.strip(" ._")
    if cleaned.upper() in _WINDOWS_RESERVED_NAMES:
        cleaned = f"_{cleaned}"
    return cleaned


def sanitize_project_name(name: str) -> str:
    """Sanitizes a string to be a valid folder name on Linux/Windows."""
    cleaned = sanitize_filename_component(name)
    return cleaned or "nowy_projekt"


# Keeps the folder name (plus the workspace prefix and a "_N" suffix) within
# typical Windows MAX_PATH limits.
_MAX_PROJECT_SLUG_LENGTH = 60


def _normalize_date_segment(date_str: str) -> str:
    """Normalizes a training date into a sortable ``YYYY-MM-DD`` folder segment."""
    text = (date_str or "").strip()
    if not text:
        return ""

    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Unknown format: fall back to a sanitized, filesystem-safe segment.
    return sanitize_filename_component(text)


def build_project_base_name(topic: str, date_str: str = "") -> str:
    """
    Builds a human-readable, collision-friendly base name for a project folder.

    Format: ``<YYYY-MM-DD>_<topic-slug>`` where the date segment is omitted when
    unavailable. The date is a prefix so folders sort chronologically. The result
    is sanitized and truncated so it fits within path limits once the workspace
    prefix and a numeric suffix are appended.
    """
    topic_slug = sanitize_project_name(topic) if (topic or "").strip() else ""
    date_slug = _normalize_date_segment(date_str)

    # Reserve room for the date prefix so it survives long topics.
    if topic_slug:
        reserved = len(date_slug) + 1 if date_slug else 0
        max_topic = max(_MAX_PROJECT_SLUG_LENGTH - reserved, 1)
        topic_slug = topic_slug[:max_topic].rstrip(" ._")

    base = "_".join(part for part in (date_slug, topic_slug) if part)
    return base or "nowy_projekt"


def create_project_directory(base_name: str) -> Path:
    """
    Creates a new project directory in the user workspace.

    Guarantees a unique directory for each new import by appending a numeric
    suffix (``_2``, ``_3``, ...) when the desired name is already taken.
    """
    workspace = get_workspace_dir()
    clean_base = sanitize_project_name(base_name)

    target_dir = workspace / clean_base
    if not target_dir.exists():
        target_dir.mkdir(parents=True, exist_ok=True)
        return target_dir

    counter = 2
    while True:
        candidate = workspace / f"{clean_base}_{counter}"
        if not candidate.exists():
            candidate.mkdir(parents=True, exist_ok=True)
            return candidate
        counter += 1


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
                topic = ""
                training_date = ""
                course_number = ""
                location = ""

                has_doc = bool(doc_file and doc_file.exists())
                if has_doc:
                    try:
                        data = json.loads(doc_file.read_text(encoding="utf-8"))
                        if isinstance(data, dict):
                            t = data.get("training", {})
                            if isinstance(t, dict):
                                topic = str(t.get("nazwa_szkolenia") or "").strip()
                                training_date = str(t.get("data_szkolenia") or "").strip()
                                course_number = str(t.get("numer_szkolenia") or "").strip()
                                location = str(t.get("miejsce_szkolenia") or "").strip()
                            sub_count = len(data.get("participants", []))
                    except Exception:
                        pass

                # Prefer the human topic; fall back to a friendly placeholder
                # for saved-but-untitled projects, or the folder name otherwise.
                title = topic or ("Szkolenie bez nazwy" if has_doc else item.name)

                has_cert = (item / "certyfikaty.pdf").exists()
                has_attendance = (item / "lista_obecnosci.pdf").exists()

                projects.append({
                    "name": item.name,
                    "title": title,
                    "training_date": training_date,
                    "course_number": course_number,
                    "location": location,
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
