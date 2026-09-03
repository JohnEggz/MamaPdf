import json
from pathlib import Path
import pytest
from johnmamapdfv2.json_io import load_training_document, save_training_document
from johnmamapdfv2.types import TrainingDocument, TrainingMeta, Participant


@pytest.fixture
def sample_training_document() -> TrainingDocument:
    meta: TrainingMeta = {
        "nazwa_szkolenia": "Metodyka nauczania języka polskiego",
        "numer_szkolenia": "SZK/2026/03/01",
        "data_szkolenia": "15.03.2026",
        "miejsce_szkolenia": "Kraków, ul. Floriańska 10",
        "prowadzacy": "dr Jan Kowalski",
        "czas_trwania": "8 godzin",
        "czas_trwania_od_do": "09:00 - 17:00",
        "data_wystawienia": "15.03.2026",
        "tematyka": "Innowacyjne techniki pracy z uczniem",
    }
    participants: list[Participant] = [
        {
            "imie_nazwisko": "Anna Nowak",
            "data_urodzenia": "14.06.1990",
            "miejsce_urodzenia": "Warszawa",
            "placowka": "Szkoła Podstawowa nr 1",
            "locked": False,
        },
        {
            "imie_nazwisko": "Piotr Wiśniewski",
            "data_urodzenia": "22.11.1985",
            "miejsce_urodzenia": "Gdańsk",
            "placowka": "Liceum Ogólnokształcące nr 5",
            "locked": True,
        },
    ]
    return {
        "training": meta,
        "participants": participants,
    }


def test_save_and_load_roundtrip(tmp_path: Path, sample_training_document: TrainingDocument):
    file_path = tmp_path / "training_doc.json"
    save_training_document(file_path, sample_training_document)

    loaded = load_training_document(file_path)
    assert loaded == sample_training_document


def test_save_creates_nested_directories(tmp_path: Path, sample_training_document: TrainingDocument):
    nested_path = tmp_path / "deeply" / "nested" / "dir" / "doc.json"
    save_training_document(nested_path, sample_training_document)

    assert nested_path.exists()
    loaded = load_training_document(nested_path)
    assert loaded == sample_training_document


def test_save_and_load_with_string_paths(tmp_path: Path, sample_training_document: TrainingDocument):
    file_str = str(tmp_path / "string_path_doc.json")
    save_training_document(file_str, sample_training_document)

    loaded = load_training_document(file_str)
    assert loaded == sample_training_document


def test_save_json_formatting_and_utf8(tmp_path: Path, sample_training_document: TrainingDocument):
    file_path = tmp_path / "formatted.json"
    save_training_document(file_path, sample_training_document)

    raw_text = file_path.read_text(encoding="utf-8")
    # Verify Polish characters are preserved verbatim and not unicode-escaped
    assert "języka polskiego" in raw_text
    assert "Floriańska" in raw_text
    assert "Wiśniewski" in raw_text
    assert "Gdańsk" in raw_text

    # Verify indentation
    lines = raw_text.splitlines()
    assert lines[1].startswith("    \"training\"")

    # Verify no leftover .tmp file
    tmp_file = file_path.with_suffix(".tmp")
    assert not tmp_file.exists()


def test_load_nonexistent_file_raises(tmp_path: Path):
    nonexistent = tmp_path / "does_not_exist.json"
    with pytest.raises(FileNotFoundError):
        load_training_document(nonexistent)
