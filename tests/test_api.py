from pathlib import Path
from unittest.mock import patch
from johnmamapdfv2.api import (
    api_get_initial_data,
    api_update_training_meta,
    api_update_participants,
    api_add_participant,
    api_remove_participant,
    api_generate_pdfs,
    api_open_explorer,
    api_parse_survey,
)
from johnmamapdfv2.state import state


def test_api_initial_data() -> None:
    res = api_get_initial_data()
    assert res["success"] is True
    assert "document" in res
    assert "workspace_dir" in res


def test_api_meta_and_participants_update() -> None:
    meta_res = api_update_training_meta({"nazwa_szkolenia": "Matematyka dla Nauczycieli"})
    assert meta_res["success"] is True
    assert meta_res["training"]["nazwa_szkolenia"] == "Matematyka dla Nauczycieli"

    add_res = api_add_participant({"imie_nazwisko": "Jan Kowalski", "data_urodzenia": "01.01.1980", "miejsce_urodzenia": "Kraków", "placowka": "SP 1", "locked": False})
    assert add_res["success"] is True
    assert add_res["participant"]["imie_nazwisko"] == "Jan Kowalski"

    update_res = api_update_participants([
        {"imie_nazwisko": "Piotr Nowak", "data_urodzenia": "02.02.1982", "miejsce_urodzenia": "Gdańsk", "placowka": "SP 2", "locked": False}
    ])
    assert update_res["success"] is True
    assert update_res["count"] == 1

    del_res = api_remove_participant(0)
    assert del_res["success"] is True
    assert del_res["total"] == 0


def test_api_generate_pdfs(tmp_path: Path) -> None:
    with patch("johnmamapdfv2.api.get_workspace_dir", return_value=tmp_path):
        res = api_generate_pdfs(
            meta_override={
                "nazwa_szkolenia": "Testowe Szkolenie",
                "numer_szkolenia": "01/TEST/2026",
                "data_szkolenia": "01.09.2026",
                "miejsce_szkolenia": "Kraków",
                "prowadzacy": "Jan Trener",
                "czas_trwania": "4 godz",
                "czas_trwania_od_do": "10:00 - 14:00",
                "data_wystawienia": "01.09.2026",
                "tematyka": "1. Wstęp\n2. Zakończenie",
            },
            participants_override=[
                {
                    "imie_nazwisko": "Adam Mickiewicz",
                    "data_urodzenia": "24.12.1798",
                    "miejsce_urodzenia": "Zaosie",
                    "placowka": "Uniwersytet",
                    "locked": False,
                }
            ],
        )

        assert res["success"] is True
        assert "output_dir" in res
        assert Path(res["certificate_pdf"]).exists()
        assert Path(res["attendance_pdf"]).exists()
        assert Path(res["config_json"]).exists()


def test_api_open_explorer() -> None:
    with patch("johnmamapdfv2.api.open_in_file_manager", return_value=True):
        res = api_open_explorer()
        assert res["success"] is True


def test_api_pick_spreadsheet_creates_project(tmp_path: Path) -> None:
    # Use existing test fixture ods
    fixtures_dir = Path(__file__).parent / "fixtures"
    sample_ods = list(fixtures_dir.glob("*.ods"))
    if not sample_ods:
        # If no fixture ods, mock load_participants
        mock_participants = [
            {"imie_nazwisko": "Jan Test", "data_urodzenia": "01.01.2000", "miejsce_urodzenia": "Kraków", "placowka": "SP 1", "locked": False}
        ]
        with (
            patch("johnmamapdfv2.api.get_workspace_dir", return_value=tmp_path),
            patch("johnmamapdfv2.api.pick_spreadsheet_file", return_value=Path("/tmp/kurs_bhp.ods")),
            patch("johnmamapdfv2.api.load_participants", return_value=mock_participants),
        ):
            res = api_pick_spreadsheet()
            assert res["success"] is True
            assert "active_project_path" in res
            project_dir = Path(res["active_project_path"])
            assert project_dir.exists()
            assert project_dir.parent == tmp_path
            assert (project_dir / "szkolenie.json").exists()


def test_api_generate_overwrites_pdfs(tmp_path: Path) -> None:
    with patch("johnmamapdfv2.api.get_workspace_dir", return_value=tmp_path):
        # Set active project
        proj_dir = tmp_path / "moj_projekt"
        proj_dir.mkdir(parents=True, exist_ok=True)
        state.set_active_project_dir(proj_dir)

        # 1st generation
        res1 = api_generate_pdfs(
            meta_override={"nazwa_szkolenia": "Pierwsza Wersja"},
            participants_override=[
                {"imie_nazwisko": "Test 1", "data_urodzenia": "01.01.1990", "miejsce_urodzenia": "Kraków", "placowka": "", "locked": False}
            ],
        )
        assert res1["success"] is True
        cert1 = Path(res1["certificate_pdf"])
        assert cert1.parent == proj_dir
        assert cert1.exists()

        # 2nd generation overwrites inside the same directory
        res2 = api_generate_pdfs(
            meta_override={"nazwa_szkolenia": "Druga Wersja"},
            participants_override=[
                {"imie_nazwisko": "Test 2", "data_urodzenia": "02.02.1990", "miejsce_urodzenia": "Warszawa", "placowka": "", "locked": False}
            ],
        )
        assert res2["success"] is True
        cert2 = Path(res2["certificate_pdf"])
        assert cert2 == cert1
        assert cert2.exists()


def test_api_auto_save_on_meta_update(tmp_path: Path) -> None:
    with patch("johnmamapdfv2.api.get_workspace_dir", return_value=tmp_path):
        proj_dir = tmp_path / "auto_save_proj"
        proj_dir.mkdir(parents=True, exist_ok=True)
        state.set_active_project_dir(proj_dir)

        api_update_training_meta({"nazwa_szkolenia": "Zaktualizowana Nazwa Auto"})
        saved_json = proj_dir / "szkolenie.json"
        assert saved_json.exists()
        assert "Zaktualizowana Nazwa Auto" in saved_json.read_text(encoding="utf-8")


def test_api_parse_survey_cancelled() -> None:
    with patch("johnmamapdfv2.api.pick_spreadsheet_file", return_value=None):
        res = api_parse_survey()
        assert res["success"] is False
        assert res["cancelled"] is True


def test_api_parse_survey_success() -> None:
    with (
        patch("johnmamapdfv2.api.pick_spreadsheet_file", return_value=Path("/tmp/ankieta_test.ods")),
        patch("johnmamapdfv2.api.process_survey_file", return_value="Raport ankiety..."),
    ):
        res = api_parse_survey()
        assert res["success"] is True
        assert res["cancelled"] is False
        assert res["text"] == "Raport ankiety..."
        assert res["filename"] == "ankieta_test.ods"


def test_api_parse_survey_error() -> None:
    with (
        patch("johnmamapdfv2.api.pick_spreadsheet_file", return_value=Path("/tmp/bad_survey.ods")),
        patch("johnmamapdfv2.api.process_survey_file", side_effect=ValueError("Brakująca kolumna: XYZ")),
    ):
        res = api_parse_survey()
        assert res["success"] is False
        assert res["cancelled"] is False
        assert "Brakująca kolumna: XYZ" in res["error"]

