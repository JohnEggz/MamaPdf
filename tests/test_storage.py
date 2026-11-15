from pathlib import Path

from johnmamapdfv2 import storage
from johnmamapdfv2.storage import (
    build_project_base_name,
    create_project_directory,
    sanitize_filename_component,
    sanitize_project_name,
)


def test_sanitize_filename_illegal_chars() -> None:
    assert sanitize_filename_component('a<b>c:d"e/f\\g|h?i*j') == "a_b_c_d_e_f_g_h_i_j"


def test_sanitize_filename_whitespace_collapsed_and_trimmed() -> None:
    assert sanitize_filename_component("  Jan   Kowalski  ") == "Jan_Kowalski"


def test_sanitize_filename_reserved_names() -> None:
    assert sanitize_filename_component("CON") == "_CON"
    assert sanitize_filename_component("lpt1") == "_lpt1"


def test_sanitize_project_name_fallbacks() -> None:
    assert sanitize_project_name("") == "nowy_projekt"
    assert sanitize_project_name("...") == "nowy_projekt"


# --- build_project_base_name -------------------------------------------------

def test_build_project_base_name_topic_and_date() -> None:
    assert build_project_base_name("Kurs BHP", "15.01.2025") == "Kurs_BHP_2025-01-15"


def test_build_project_base_name_without_date() -> None:
    assert build_project_base_name("Kurs BHP") == "Kurs_BHP"


def test_build_project_base_name_empty_fallback() -> None:
    assert build_project_base_name("", "") == "nowy_projekt"
    assert build_project_base_name("   ") == "nowy_projekt"


def test_build_project_base_name_unparseable_date_kept() -> None:
    assert build_project_base_name("Kurs", "wiosna") == "Kurs_wiosna"


def test_build_project_base_name_truncates_but_keeps_date() -> None:
    base = build_project_base_name("A" * 200, "15.01.2025")
    assert base.endswith("_2025-01-15")
    assert len(base) <= storage._MAX_PROJECT_SLUG_LENGTH


# --- create_project_directory ------------------------------------------------

def test_create_project_directory_unique_numeric_suffix(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(storage, "get_workspace_dir", lambda: tmp_path)

    first = create_project_directory("Kurs_BHP")
    second = create_project_directory("Kurs_BHP")
    third = create_project_directory("Kurs_BHP")

    assert first.name == "Kurs_BHP"
    assert second.name == "Kurs_BHP_2"
    assert third.name == "Kurs_BHP_3"
    assert first.exists() and second.exists() and third.exists()
