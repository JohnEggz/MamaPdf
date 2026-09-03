import json
from pathlib import Path
from typing import cast
from johnmamapdfv2.types import TrainingDocument

def load_training_document(file_path: Path | str) -> TrainingDocument:
    """Reads a JSON file from disk and casts it into TrainingDocument."""
    path = Path(file_path)
    raw_text = path.read_text(encoding="utf-8")
    raw_data = cast(object, json.loads(raw_text))
    return cast(TrainingDocument, raw_data)

def save_training_document(file_path: Path | str, doc: TrainingDocument) -> None:
    """Serializes and writes a TrainingDocument to disk."""
    path = Path(file_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    json_bytes = json.dumps(doc, indent=4, ensure_ascii=False).encode("utf-8")

    temp_path = path.with_suffix(".tmp")
    _ = temp_path.write_bytes(json_bytes)
    _ = temp_path.replace(path)
