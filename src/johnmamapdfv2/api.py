from pathlib import Path
from typing import Any
import eel

from johnmamapdfv2.dialogs import (
    open_in_file_manager,
    pick_spreadsheet_file,
)
from johnmamapdfv2.json_io import load_training_document, save_training_document
from johnmamapdfv2.paths import get_workspace_dir
from johnmamapdfv2.spreadsheet_parser import load_participants
from johnmamapdfv2.state import create_empty_document, state
from johnmamapdfv2.storage import create_project_directory, list_workspace_projects
from johnmamapdfv2.types import Participant, TrainingDocument
from johnmamapdfv2.typst_generator import compile_all_documents


@eel.expose
def api_get_initial_data() -> dict[str, Any]:
    """
    Returns the current backend state, active project path, and workspace projects list.
    Automatically activates the most recent project if available.
    """
    projects = list_workspace_projects()

    # If no project is currently loaded in memory, activate the most recent project
    if state.active_project_dir is None and projects:
        first_proj = projects[0]
        proj_path = Path(first_proj["path"])
        if first_proj.get("json_file"):
            try:
                doc = load_training_document(first_proj["json_file"])
                state.set_document(doc, project_dir=proj_path)
            except Exception:
                state.set_active_project_dir(proj_path)
        else:
            state.set_active_project_dir(proj_path)

    return {
        "success": True,
        "document": state.get_document(),
        "active_project_path": str(state.active_project_dir) if state.active_project_dir else None,
        "storage_projects": projects,
        "workspace_dir": str(get_workspace_dir()),
    }


@eel.expose
def api_pick_spreadsheet() -> dict[str, Any]:
    """
    Opens native OS dialog to pick .ods/.xlsx.
    Creates a brand new project directory in the workspace, sets it as active,
    parses participants, and auto-saves the project immediately.
    """
    file_path = pick_spreadsheet_file()
    if not file_path:
        return {"success": False, "cancelled": True}

    try:
        participants = load_participants(file_path)

        # Create a new project directory for this import
        project_dir = create_project_directory(file_path.stem)

        # Initialize new document with participants and course title preset to file name
        new_doc = create_empty_document()
        new_doc["training"]["nazwa_szkolenia"] = file_path.stem.replace("_", " ")
        new_doc["participants"] = participants

        # Activate project in state and save
        state.set_document(new_doc, source_path=str(file_path), project_dir=project_dir)
        state.auto_save()

        return {
            "success": True,
            "cancelled": False,
            "active_project_path": str(project_dir),
            "project_name": project_dir.name,
            "document": state.get_document(),
            "count": len(participants),
            "storage_projects": list_workspace_projects(),
        }
    except Exception as exc:
        return {
            "success": False,
            "cancelled": False,
            "error": f"Błąd podczas wczytywania arkusza: {exc}",
        }


@eel.expose
def api_load_storage_project(path_str: str) -> dict[str, Any]:
    """Activates and loads an existing project directory from the storage list."""
    path = Path(path_str)
    try:
        json_file = path / "szkolenie.json"
        if not json_file.exists():
            jsons = list(path.glob("*.json"))
            if jsons:
                json_file = jsons[0]

        if json_file.exists():
            doc = load_training_document(json_file)
            state.set_document(doc, source_path=str(json_file), project_dir=path)
        else:
            # If no JSON exists yet, set directory and auto-save current
            state.set_active_project_dir(path)
            state.auto_save()

        return {
            "success": True,
            "active_project_path": str(path),
            "document": state.get_document(),
        }
    except Exception as exc:
        return {
            "success": False,
            "error": f"Nie udało się załadować projektu: {exc}",
        }


@eel.expose
def api_get_storage_list() -> list[dict[str, Any]]:
    """Returns refreshed storage project list."""
    return list_workspace_projects()


@eel.expose
def api_update_training_meta(meta: dict[str, Any]) -> dict[str, Any]:
    """Updates training metadata in state and auto-saves to disk."""
    training = state.update_training_meta(meta)
    return {"success": True, "training": training}


@eel.expose
def api_update_participants(participants: list[dict[str, Any]]) -> dict[str, Any]:
    """Updates all participants in state and auto-saves to disk."""
    typed_participants: list[Participant] = []
    for p in participants:
        typed_participants.append({
            "imie_nazwisko": str(p.get("imie_nazwisko", "")).strip(),
            "data_urodzenia": str(p.get("data_urodzenia", "")).strip(),
            "miejsce_urodzenia": str(p.get("miejsce_urodzenia", "")).strip(),
            "placowka": str(p.get("placowka", "")).strip(),
            "locked": bool(p.get("locked", False)),
        })
    state.set_participants(typed_participants)
    return {"success": True, "count": len(typed_participants)}


@eel.expose
def api_add_participant(participant: dict[str, Any] | None = None) -> dict[str, Any]:
    """Appends a new participant to state and auto-saves to disk."""
    if participant:
        p: Participant = {
            "imie_nazwisko": str(participant.get("imie_nazwisko", "")),
            "data_urodzenia": str(participant.get("data_urodzenia", "")),
            "miejsce_urodzenia": str(participant.get("miejsce_urodzenia", "")),
            "placowka": str(participant.get("placowka", "")),
            "locked": bool(participant.get("locked", False)),
        }
    else:
        p = {
            "imie_nazwisko": "",
            "data_urodzenia": "",
            "miejsce_urodzenia": "",
            "placowka": "",
            "locked": False,
        }
    added = state.add_participant(p)
    return {
        "success": True,
        "participant": added,
        "total": len(state.document["participants"]),
    }


@eel.expose
def api_remove_participant(index: int) -> dict[str, Any]:
    """Removes a participant by index and auto-saves to disk."""
    success = state.remove_participant(index)
    return {
        "success": success,
        "total": len(state.document["participants"]),
    }


@eel.expose
def api_generate_pdfs(
    meta_override: dict[str, Any] | None = None,
    participants_override: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Compiles Typst documents (certificate and attendance list),
    overwriting the PDFs directly inside the active project directory.
    """
    if meta_override:
        state.update_training_meta(meta_override)
    if participants_override is not None:
        typed_participants: list[Participant] = []
        for p in participants_override:
            typed_participants.append({
                "imie_nazwisko": str(p.get("imie_nazwisko", "")).strip(),
                "data_urodzenia": str(p.get("data_urodzenia", "")).strip(),
                "miejsce_urodzenia": str(p.get("miejsce_urodzenia", "")).strip(),
                "placowka": str(p.get("placowka", "")).strip(),
                "locked": bool(p.get("locked", False)),
            })
        state.set_participants(typed_participants)

    doc: TrainingDocument = state.get_document()

    # Ensure there is an active project directory
    if state.active_project_dir is None or not state.active_project_dir.exists():
        title = doc["training"].get("nazwa_szkolenia") or "szkolenie"
        project_dir = create_project_directory(title)
        state.set_active_project_dir(project_dir)

    target_dir = state.active_project_dir
    target_dir.mkdir(parents=True, exist_ok=True)

    try:
        # Save / update szkolenie.json snapshot
        config_path = target_dir / "szkolenie.json"
        save_training_document(config_path, doc)

        # Compile documents, overwriting certyfikaty.pdf and lista_obecnosci.pdf in project directory
        results = compile_all_documents(doc, target_dir)

        return {
            "success": True,
            "active_project_path": str(target_dir),
            "output_dir": str(target_dir),
            "certificate_pdf": str(results["certificate"]),
            "attendance_pdf": str(results["attendance"]),
            "config_json": str(config_path),
            "message": f"Wygenerowano PDF w projekcie: {target_dir.name}",
            "storage_projects": list_workspace_projects(),
        }
    except Exception as exc:
        return {
            "success": False,
            "error": f"Błąd kompilacji Typst: {exc}",
        }


@eel.expose
def api_open_explorer(target_path: str | None = None) -> dict[str, Any]:
    """Opens system file manager at active project directory or workspace."""
    folder = Path(target_path) if target_path else state.last_output_dir
    success = open_in_file_manager(folder)
    return {
        "success": success,
        "path": str(folder),
    }
