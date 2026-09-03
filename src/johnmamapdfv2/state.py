from datetime import date
from pathlib import Path
from typing import Any
from johnmamapdfv2.json_io import save_training_document
from johnmamapdfv2.paths import get_workspace_dir
from johnmamapdfv2.types import Participant, TrainingDocument, TrainingMeta


def create_empty_document() -> TrainingDocument:
    """Creates a blank TrainingDocument with defaults."""
    today_str = date.today().strftime("%d.%m.%Y")
    return {
        "training": {
            "nazwa_szkolenia": "",
            "numer_szkolenia": "",
            "data_szkolenia": today_str,
            "miejsce_szkolenia": "",
            "prowadzacy": "",
            "czas_trwania": "",
            "czas_trwania_od_do": "",
            "data_wystawienia": today_str,
            "tematyka": "",
        },
        "participants": [],
    }


class AppState:
    """Singleton managing in-memory state of the document and active workspace project."""

    def __init__(self) -> None:
        self.document: TrainingDocument = create_empty_document()
        self.current_source_file: str | None = None
        self.active_project_dir: Path | None = None

    @property
    def last_output_dir(self) -> Path:
        if self.active_project_dir and self.active_project_dir.exists():
            return self.active_project_dir
        return get_workspace_dir()

    @last_output_dir.setter
    def last_output_dir(self, path: Path) -> None:
        self.active_project_dir = path

    def reset(self) -> None:
        self.document = create_empty_document()
        self.current_source_file = None
        self.active_project_dir = None

    def auto_save(self) -> None:
        """Automatically saves state to szkolenie.json in the active project directory."""
        if self.active_project_dir:
            try:
                self.active_project_dir.mkdir(parents=True, exist_ok=True)
                target = self.active_project_dir / "szkolenie.json"
                save_training_document(target, self.document)
            except Exception:
                pass

    def get_document(self) -> TrainingDocument:
        return self.document

    def set_document(
        self,
        doc: TrainingDocument,
        source_path: str | None = None,
        project_dir: Path | None = None,
    ) -> None:
        self.document = doc
        if source_path:
            self.current_source_file = source_path
        if project_dir:
            self.active_project_dir = project_dir

    def set_active_project_dir(self, path: Path | str | None) -> None:
        self.active_project_dir = Path(path) if path else None

    def update_training_meta(self, meta_update: dict[str, Any]) -> TrainingMeta:
        training = self.document.get("training", {})
        for key in (
            "nazwa_szkolenia",
            "numer_szkolenia",
            "data_szkolenia",
            "miejsce_szkolenia",
            "prowadzacy",
            "czas_trwania",
            "czas_trwania_od_do",
            "data_wystawienia",
            "tematyka",
        ):
            if key in meta_update:
                training[key] = str(meta_update[key] or "")
        self.document["training"] = training
        self.auto_save()
        return training

    def set_participants(self, participants: list[Participant]) -> list[Participant]:
        self.document["participants"] = participants
        self.auto_save()
        return self.document["participants"]

    def add_participant(self, participant: Participant | None = None) -> Participant:
        if participant is None:
            participant = {
                "imie_nazwisko": "",
                "data_urodzenia": "",
                "miejsce_urodzenia": "",
                "placowka": "",
                "locked": False,
            }
        else:
            participant.setdefault("locked", False)
        self.document["participants"].append(participant)
        self.auto_save()
        return participant

    def remove_participant(self, index: int) -> bool:
        participants = self.document.get("participants", [])
        if 0 <= index < len(participants):
            participants.pop(index)
            self.auto_save()
            return True
        return False

    def update_participant_cell(self, index: int, field: str, value: Any) -> bool:
        participants = self.document.get("participants", [])
        if 0 <= index < len(participants):
            participants[index][field] = value
            self.auto_save()
            return True
        return False


# Global app state instance
state = AppState()
