from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest

from johnmamapdfv2.spreadsheet_parser import (
    _normalize_birth_date,
    _normalize_location,
    load_participants,
    parse_participants,
    read_raw_sheet,
)

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
SAMPLE_FILE = FIXTURES_DIR / "ankieta.ods"


def test_read_raw_sheet_success():
    sheet_data = read_raw_sheet(SAMPLE_FILE)
    assert isinstance(sheet_data, list)
    assert len(sheet_data) == 4
    # Check header row
    assert "Imię i nazwisko uczestnika:" in sheet_data[0]


def test_read_raw_sheet_no_sheets_error():
    with patch("johnmamapdfv2.spreadsheet_parser.CalamineWorkbook.from_path") as mock_from_path:
        mock_wb = MagicMock()
        mock_wb.sheet_names = []
        mock_from_path.return_value = mock_wb

        dummy_path = Path("nonexistent_wb.ods")
        with pytest.raises(ValueError, match="Workbook has no sheets"):
            read_raw_sheet(dummy_path)


def test_read_raw_sheet_nonexistent_file():
    with pytest.raises(Exception):
        read_raw_sheet(Path("definitely_nonexistent_file_12345.ods"))


def test_load_participants_from_file():
    participants = load_participants(SAMPLE_FILE)
    assert len(participants) == 3
    assert participants[0] == {
        "imie_nazwisko": "John Doe",
        "data_urodzenia": "07.04.1981",
        "miejsce_urodzenia": "Radom",
        "placowka": "SP99 Kraków",
        "locked": False,
    }
    assert participants[1] == {
        "imie_nazwisko": "Robert Sigma",
        "data_urodzenia": "14.06.1998",
        "miejsce_urodzenia": "Kraków",
        "placowka": "Szkoła",
        "locked": False,
    }
    assert participants[2] == {
        "imie_nazwisko": "Mike Hawk",
        "data_urodzenia": "20.11.1964",
        "miejsce_urodzenia": "Świeboniowice",
        "placowka": "Szkoła Podstawowa nr 9999 w krakowie",
        "locked": False,
    }


def test_parse_participants_empty_and_short_rows():
    # Empty grid
    assert parse_participants([]) == []

    # Grid with only header
    assert parse_participants([["Timestamp", "Name", "Birth date", "Birth place", "Workplace"]]) == []

    # Grid with rows shorter than 5 elements
    grid_with_short_rows = [
        ["Header1", "Header2", "Header3", "Header4", "Header5"],
        ["val1", "Short Row"],
        ["val1", "Row with 3", "val3"],
        ["val1", "Row with 4", "val3", "val4"],
    ]
    assert parse_participants(grid_with_short_rows) == []


def test_parse_participants_empty_names_and_whitespace():
    grid = [
        ["Timestamp", "Name", "Birth date", "Birth place", "Workplace"],
        ["ts1", "", "01.01.1990", "Warszawa", "Szkoła 1"],
        ["ts2", "   ", "02.02.1990", "Kraków", "Szkoła 2"],
        ["ts3", "  Anna Kowalska  ", "03.03.1990", "gdańsk", "  Liceum Ogólnokształcące  "],
    ]
    participants = parse_participants(grid)
    assert len(participants) == 1
    assert participants[0] == {
        "imie_nazwisko": "Anna Kowalska",
        "data_urodzenia": "03.03.1990",
        "miejsce_urodzenia": "Gdańsk",
        "placowka": "Liceum Ogólnokształcące",
        "locked": False,
    }


@pytest.mark.parametrize(
    ("input_date", "expected_date"),
    [
        # Standard formats with numeric months and various separators
        ("07.04.1981", "07.04.1981"),
        ("14-06-1998", "14.06.1998"),
        ("20/11/1964", "20.11.1964"),
        ("5 3 1995", "05.03.1995"),
        ("12_08,1990", "12.08.1990"),
        ("01\\02\\2000", "01.02.2000"),
        # Single digit days and months
        ("1.5.1990", "01.05.1990"),
        # Polish months (nominative, genitive, with/without diacritics)
        ("15 stycznia 1990", "15.01.1990"),
        ("15 styczen 1990", "15.01.1990"),
        ("15 styczeń 1990", "15.01.1990"),
        ("22 lutego 1985", "22.02.1985"),
        ("22 luty 1985", "22.02.1985"),
        ("3 marca 2000", "03.03.2000"),
        ("3 marzec 2000", "03.03.2000"),
        ("10 kwietnia 1995", "10.04.1995"),
        ("10 kwiecien 1995", "10.04.1995"),
        ("10 kwiecień 1995", "10.04.1995"),
        ("1 maja 2001", "01.05.2001"),
        ("1 maj 2001", "01.05.2001"),
        ("30 czerwca 1980", "30.06.1980"),
        ("30 czerwiec 1980", "30.06.1980"),
        ("14 lipca 1992", "14.07.1992"),
        ("14 lipiec 1992", "14.07.1992"),
        ("5 sierpnia 1988", "05.08.1988"),
        ("5 sierpień 1988", "05.08.1988"),
        ("5 sierpien 1988", "05.08.1988"),
        ("12 września 1975", "12.09.1975"),
        ("12 wrzesien 1975", "12.09.1975"),
        ("12 wrzesień 1975", "12.09.1975"),
        ("18 października 1982", "18.10.1982"),
        ("18 pazdziernik 1982", "18.10.1982"),
        ("18 październik 1982", "18.10.1982"),
        ("25 listopada 1999", "25.11.1999"),
        ("25 listopad 1999", "25.11.1999"),
        ("31 grudnia 2010", "31.12.2010"),
        ("31 grudzien 2010", "31.12.2010"),
        ("31 grudzień 2010", "31.12.2010"),
        # 2-digit years (> 30 -> 19xx, <= 30 -> 20xx)
        ("15 05 85", "15.05.1985"),
        ("15 05 31", "15.05.1931"),
        ("15 05 30", "15.05.2030"),
        ("15 05 25", "15.05.2025"),
        ("15 05 05", "15.05.2005"),
        ("15 05 00", "15.05.2000"),
        # Fallbacks for malformed components
        ("abc 05 1990", "01.05.1990"),
        ("10 unknownmonth 1990", "10.01.1990"),
        ("10 99 1990", "10.99.1990"),
    ],
)
def test_normalize_birth_date_valid(input_date: str, expected_date: str):
    assert _normalize_birth_date(input_date) == expected_date


@pytest.mark.parametrize(
    "short_input",
    [
        "",
        "1999",
        "05.1999",
        "only two",
    ],
)
def test_normalize_birth_date_short_input_returns_raw(short_input: str):
    assert _normalize_birth_date(short_input) == short_input


@pytest.mark.parametrize(
    ("input_loc", "expected_loc"),
    [
        ("", "Nieznane"),
        (None, "Nieznane"),
        ("nan", "Nieznane"),
        ("NaN", "Nieznane"),
        ("NAN", "Nieznane"),
        ("kraków", "Kraków"),
        ("WARSZAWA", "Warszawa"),
        ("Radom", "Radom"),
        ("bielsko-biała", "Bielsko-Biała"),
        ("nowy dwór mazowiecki", "Nowy Dwór Mazowiecki"),
        ("kĘdZiErZyN-kOźLe", "Kędzierzyn-Koźle"),
        ("Świeboniowice", "Świeboniowice"),
        ("warszawa 1", "Warszawa 1"),
        ("ostrów wlkp.", "Ostrów Wlkp."),
    ],
)
def test_normalize_location(input_loc: str | None, expected_loc: str):
    assert _normalize_location(input_loc) == expected_loc  # pyright: ignore[reportArgumentType]


# ============================================================================
# Survey (Ankieta) Parser Tests
# ============================================================================

from johnmamapdfv2.spreadsheet_parser import (
    KEYS_AVERAGE,
    KEY_LISTA,
    KEY_TAK_NIE,
    KEY_SORTING,
    MULTI_CHOICE_KEY,
    validate_columns,
    analyze_survey_grid,
    analyze_spreadsheet,
    format_summary_to_string,
    process_survey_file,
    process_ods_buffer,
)
import sys
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def test_survey_validate_columns_valid():
    valid_headers = ["Sygnatura czasowa"] + list(KEYS_AVERAGE) + [KEY_LISTA, KEY_TAK_NIE, KEY_SORTING]
    is_valid, missing = validate_columns(valid_headers)
    assert is_valid is True
    assert missing is None


def test_survey_validate_columns_missing():
    # Missing KEY_TAK_NIE
    headers = ["Sygnatura czasowa"] + list(KEYS_AVERAGE) + [KEY_LISTA, KEY_SORTING]
    is_valid, missing = validate_columns(headers)
    assert is_valid is False
    assert missing == KEY_TAK_NIE


def test_survey_validate_columns_whitespace_resilience():
    # Stripped headers without trailing spaces
    headers = [h.strip() for h in list(KEYS_AVERAGE) + [KEY_LISTA, KEY_TAK_NIE, KEY_SORTING]]
    is_valid, missing = validate_columns(headers)
    assert is_valid is True
    assert missing is None


def test_survey_analyze_survey_grid_and_format():
    headers = ["Sygnatura czasowa"] + list(KEYS_AVERAGE) + [KEY_LISTA, KEY_TAK_NIE, KEY_SORTING, "Inne uwagi"]
    row1 = [
        "2026-03-03 12:00:00",
        5, 4, 5, 5, 5, 4,
        "Świetne szkolenie!",
        "Tak",
        "TIK w pracy nauczyciela, Prawo oświatowe",
        "Wszystko super",
    ]
    row2 = [
        "2026-03-03 12:05:00",
        4, 5, 4, 4, 5, 5,
        "Więcej warsztatów",
        "Tak",
        "Bezpieczeństwo w sieci uczniów i nauczycieli, Nowy nieznany temat",
        "Wszystko super",
    ]
    row3 = [
        "2026-03-03 12:10:00",
        5, 5, 5, 5, 5, 5,
        "",
        "Nie wiem",
        "brak",
        "Może być",
    ]
    grid = [headers, row1, row2, row3]

    summary = analyze_survey_grid(grid)

    # Check average scores
    assert summary[KEYS_AVERAGE[0]] == round((5 + 4 + 5) / 3, 1)  # 4.7
    assert summary[KEYS_AVERAGE[1]] == round((4 + 5 + 5) / 3, 1)  # 4.7

    # Check remarks list (empty string filtered out)
    assert summary[KEY_LISTA] == ["Świetne szkolenie!", "Więcej warsztatów"]

    # Check tak/nie counts
    assert summary[KEY_TAK_NIE] == {"Tak": 2, "Nie wiem": 1, "Nie": 0}

    # Check multi-choice sorting
    assert summary[KEY_SORTING]["TIK w pracy nauczyciela"] == 1
    assert summary[KEY_SORTING]["Prawo oświatowe"] == 1
    assert summary[KEY_SORTING]["Bezpieczeństwo w sieci uczniów i nauczycieli"] == 1
    assert summary[KEY_SORTING]["inne"] == 1

    # Check arbitrary text column
    assert summary["Inne uwagi"]["type"] == "text"
    assert summary["Inne uwagi"]["counts"]["Wszystko super"] == 2
    assert summary["Inne uwagi"]["counts"]["Może być"] == 1

    # Check Sygnatura czasowa excluded
    assert "Sygnatura czasowa" not in summary

    # Check formatted string
    text = format_summary_to_string(summary)
    assert KEYS_AVERAGE[0] in text
    assert KEY_LISTA in text
    assert "Świetne szkolenie!" in text
    assert "Więcej warsztatów" in text
    assert "Tak" in text
    assert "--------------------" in text


def test_survey_analyze_empty_grid_raises():
    with pytest.raises(ValueError, match="Arkusz nie zawiera żadnych danych"):
        analyze_survey_grid([])


def test_survey_analyze_missing_column_raises():
    grid = [["Nieprawidłowy nagłówek 1", "Nieprawidłowy nagłówek 2"]]
    with pytest.raises(ValueError, match="Nieprawidłowy format pliku. Brakująca kolumna"):
        analyze_survey_grid(grid)


def test_survey_process_ods_buffer_error_handling():
    # Passing invalid buffer string returns error message string rather than raising
    err = process_ods_buffer(b"invalid data")
    assert "Błąd podczas przetwarzania pliku:" in err



def test_process_survey_file_with_mocked_sheet(tmp_path: Path):
    headers = ["Sygnatura czasowa"] + list(KEYS_AVERAGE) + [KEY_LISTA, KEY_TAK_NIE, KEY_SORTING]
    row1 = ["2026-03-03", 5, 5, 5, 5, 5, 5, "Uwaga 1", "Tak", "Prawo oświatowe"]
    mock_grid = [headers, row1]

    dummy_path = tmp_path / "survey.ods"
    dummy_path.touch()

    with patch("johnmamapdfv2.spreadsheet_parser.read_raw_sheet", return_value=mock_grid):
        output = process_survey_file(dummy_path)
        assert KEYS_AVERAGE[0] in output
        assert "5.0" in output
        assert "Uwaga 1" in output
        assert "Tak" in output


