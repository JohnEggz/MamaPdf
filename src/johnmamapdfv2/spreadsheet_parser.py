from collections import Counter
from collections.abc import Sequence
import io
from pathlib import Path
import re
from statistics import mean
from typing import Any

from python_calamine import CalamineWorkbook

from johnmamapdfv2.types import Participant


# ============================================================================
# Survey (Ankieta) Parser Constants
# ============================================================================

KEYS_AVERAGE = (
    "Tematyka szkolenia dostosowana została do zgłoszonych potrzeb (1 - najniższa ocena, 5 najwyższa ocena):",
    "Czas trwania zajęć dostosowany był do potrzeb uczestników (1 - najniższa ocena, 5 najwyższa ocena):",
    "Na ile ocenia Pan/Pani przygotowanie merytoryczne trenera / edukatora (1 - najniższa ocena, 5 najwyższa ocena):",
    "Na ile trener zrealizował cele szkolenia (1 - najniższa ocena, 5 najwyższa ocena): ",
    "Jak ocenia Pan / Pani sposób prowadzenia zajęć przez trenera / edukatora (1 - najniższa ocena, 5 najwyższa ocena): ",
    "Na ile trener / edukator odpowiadał na potrzeby zgłaszane przez uczestników   (1 - najniższa ocena, 5 najwyższa ocena): ",
)
KEY_LISTA = "Dodatkowe uwagi dla trenera/ edukatora lub placówki"
KEY_TAK_NIE = "Czy polecił/a by Pan/Pani kurs innym?"
KEY_SORTING = "Jakie inne szkolenia byłyby interesujące dla Pana/ Pani w przyszłości - można zaznaczyć kilka odpowiedzi:"

MULTI_CHOICE_KEY = [
    "Wsparcie dziecka o SPE: spektrum autyzmu, afazja, niepełnosprawność intelektualna",
    "Wsparcie dziecka o SPE: dysleksja, dysgrafia, dysortografia, dyskalkulia",
    "Wsparcie dziecka z problemami emocjonalnymi: depresja, zaburzenia lękowe, doświadczenia postraumatyczne, uzależnienia od urządzeń ekranowych",
    "Wsparcie dziecka z trudnościami w zachowaniu: bunt, agresja, przemoc rówieśnicza",
    "Zagrożenia dla rozwoju współczesnego dziecka/ nastolatka: używki, uzależnienia behawioralne",
    "Wspomaganie pamięci i koncentracji uczniów",
    "TIK w pracy nauczyciela",
    "Bezpieczeństwo w sieci uczniów i nauczycieli",
    "Prawo oświatowe",
    "Stres w pracy, wzmacnianie odporności psychicznej i dobrostanu nauczycieli",
    "Praca z klasą zróżnicowaną kulturowo (uczeń z zagranicy z zespole klasowym)",
    "Praca z klasą zróżnicowaną edukacyjnie",
    'Praca z klasą "trudną" (konflikty, kłopoty z dyscypliną, brak aktywności, słaba motywacja)',
    "Ciekawe lekcje wychowawcze",
    'Współpraca z rodzicami (w tym z "wymagającym" rodzicem)',
]


# ============================================================================
# Core Sheet Reader
# ============================================================================

def read_raw_sheet(file_path: Path):
    workbook = CalamineWorkbook.from_path(file_path)  # pyright: ignore[reportUnknownMemberType]
    if not workbook.sheet_names:
        raise ValueError(f"Workbook has no sheets: {file_path}")
    sheet_name = workbook.sheet_names[0]
    return workbook.get_sheet_by_name(sheet_name).to_python()


# ============================================================================
# Participant List Parser
# ============================================================================

def parse_participants(grid: Sequence[Sequence[object]]) -> list[Participant]:
    data_rows = grid[1:]

    participants: list[Participant] = []
    for row in data_rows:
        if len(row) < 5:
            continue

        name = str(row[1]).strip()
        if not name:
            continue

        participants.append({
            "imie_nazwisko": name,
            "data_urodzenia": _normalize_birth_date(str(row[2])),
            "miejsce_urodzenia": _normalize_location(str(row[3])),
            "placowka": str(row[4]).strip(),
            "locked": False,
        })

    return participants


def _normalize_birth_date(raw_val: str) -> str:
    cleaned = re.sub(r'[-\,\_\/\\\.]', ' ', str(raw_val)).strip()
    parts = cleaned.split()
    if len(parts) < 3:
        return str(raw_val)

    try:
        day = int(parts[0])
    except ValueError:
        day = 1

    month_raw = parts[1].lower()
    months = {
        "styczeń": 1, "stycznia": 1, "styczen": 1, "01": 1, "1": 1,
        "luty": 2, "lutego": 2, "02": 2, "2": 2,
        "marzec": 3, "marca": 3, "03": 3, "3": 3,
        "kwiecień": 4, "kwietnia": 4, "kwiecien": 4, "04": 4, "4": 4,
        "maj": 5, "maja": 5, "05": 5, "5": 5,
        "czerwiec": 6, "czerwca": 6, "06": 6, "6": 6,
        "lipiec": 7, "lipca": 7, "07": 7, "7": 7,
        "sierpień": 8, "sierpnia": 8, "sierpien": 8, "08": 8, "8": 8,
        "wrzesień": 9, "września": 9, "wrzesien": 9, "09": 9, "9": 9,
        "październik": 10, "października": 10, "pazdziernik": 10, "10": 10,
        "listopad": 11, "listopada": 11, "11": 11,
        "grudzień": 12, "grudnia": 12, "grudzien": 12, "12": 12,
    }

    month = months.get(month_raw)
    if not month:
        try:
            month = int(month_raw)
        except ValueError:
            month = 1

    year_raw = parts[2]
    if len(year_raw) == 2:
        year = f"19{year_raw}" if int(year_raw) > 30 else f"20{year_raw}"
    else:
        year = year_raw

    return f"{day:02d}.{month:02d}.{year}"


def _normalize_location(raw: str | None) -> str:
    if not raw or str(raw).lower() == "nan":
        return "Nieznane"
    result: list[str] = []
    capitalize_next = True
    for c in str(raw):
        if c.isalpha():
            result.append(c.upper() if capitalize_next else c.lower())
            capitalize_next = False
        else:
            result.append(c)
            capitalize_next = True
    return "".join(result)


def load_participants(file_path: Path) -> list[Participant]:
    raw_data = read_raw_sheet(file_path)
    return parse_participants(raw_data)


# ============================================================================
# Survey (Ankieta) Parser Logic
# ============================================================================

def _norm_header(h: object) -> str:
    """Normalizes whitespace in column headers for resilient matching."""
    return " ".join(str(h).split())


def validate_columns(headers: Sequence[object]) -> tuple[bool, str | None]:
    """Checks if all required columns are present in the headers."""
    header_strs = [str(h) for h in headers if h is not None]
    norm_headers = {_norm_header(h) for h in header_strs}
    required = list(KEYS_AVERAGE) + [KEY_LISTA, KEY_TAK_NIE, KEY_SORTING]
    for req in required:
        if req not in header_strs and _norm_header(req) not in norm_headers:
            return False, req
    return True, None


def analyze_survey_grid(grid: Sequence[Sequence[object]]) -> dict[str, Any]:
    """Core analysis logic on raw 2D sheet grid."""
    if not grid or len(grid) < 1:
        raise ValueError("Arkusz nie zawiera żadnych danych.")

    header_row = grid[0]
    col_headers: list[tuple[int, str]] = [
        (c, str(val)) for c, val in enumerate(header_row) if val is not None and str(val) != ""
    ]
    headers = [h for _, h in col_headers]

    is_valid, missing_col = validate_columns(headers)
    if not is_valid:
        raise ValueError(f"Nieprawidłowy format pliku. Brakująca kolumna: '{missing_col}'")

    columns: dict[str, list[object]] = {h: [] for h in headers}
    for row in grid[1:]:
        for c, h in col_headers:
            if c < len(row):
                val = row[c]
                if val is not None and str(val).strip() != "":
                    columns[h].append(val)

    summary: dict[str, Any] = {}
    for header, values in columns.items():
        norm_h = _norm_header(header)
        if norm_h == "Sygnatura czasowa":
            continue
        elif any(norm_h == _norm_header(k) for k in KEYS_AVERAGE):
            numeric_values: list[float] = []
            for v in values:
                try:
                    numeric_values.append(float(v))  # pyright: ignore[reportArgumentType]
                except (TypeError, ValueError):
                    pass
            if numeric_values:
                summary[header] = round(mean(numeric_values), 1)
            else:
                summary[header] = "N/A (Brak poprawnych danych liczbowych)"
        elif norm_h == _norm_header(KEY_LISTA):
            new_items: list[str] = []
            for value in values:
                cleaned = str(value).replace("\n", "").strip()
                if cleaned:
                    new_items.append(cleaned)
            summary[header] = new_items
        elif norm_h == _norm_header(KEY_TAK_NIE):
            tak, nie_wiem, nie = 0, 0, 0
            for value in values:
                value_str = str(value).strip()
                if value_str == "Tak":
                    tak += 1
                elif value_str == "Nie wiem":
                    nie_wiem += 1
                elif value_str == "Nie":
                    nie += 1
            summary[header] = {"Tak": tak, "Nie wiem": nie_wiem, "Nie": nie}
        elif norm_h == _norm_header(KEY_SORTING):
            temp = {item: 0 for item in MULTI_CHOICE_KEY}
            temp["inne"] = 0
            for value in values:
                found = False
                value_str = str(value)
                for item in MULTI_CHOICE_KEY:
                    if item in value_str:
                        temp[item] += 1
                        found = True
                if not found:
                    temp["inne"] += 1
            summary[header] = temp
        else:
            summary[header] = {
                "type": "text",
                "counts": dict(Counter(str(v).strip() for v in values if str(v).strip())),
            }
    return summary


def analyze_spreadsheet(spreadsheet: Any) -> dict[str, Any]:
    """
    Analyzes a spreadsheet containing survey data.
    Accepts Path, string path, CalamineWorkbook, file buffer, or pre-read 2D grid.
    """
    if isinstance(spreadsheet, (Path, str)):
        grid = read_raw_sheet(Path(spreadsheet))
    elif isinstance(spreadsheet, CalamineWorkbook):
        if not spreadsheet.sheet_names:
            raise ValueError("Arkusz nie zawiera żadnych stron.")
        sheet_name = spreadsheet.sheet_names[0]
        grid = spreadsheet.get_sheet_by_name(sheet_name).to_python()
    elif hasattr(spreadsheet, "read"):
        data = spreadsheet.read()
        if isinstance(data, str):
            data = data.encode("utf-8")
        wb = CalamineWorkbook.from_filelike(io.BytesIO(data))  # pyright: ignore[reportUnknownMemberType]
        if not wb.sheet_names:
            raise ValueError("Arkusz nie zawiera żadnych stron.")
        sheet_name = wb.sheet_names[0]
        grid = wb.get_sheet_by_name(sheet_name).to_python()
    elif isinstance(spreadsheet, Sequence):
        grid = spreadsheet
    else:
        raise TypeError(f"Nieobsługiwany typ źródła arkusza: {type(spreadsheet)}")

    return analyze_survey_grid(grid)


def format_summary_to_string(summary_data: dict[str, Any]) -> str:
    """Formats the data into a plain-text report."""
    output: list[str] = []
    for key, value in summary_data.items():
        output.append(f"{key}")
        if isinstance(value, list):
            for item in value:
                output.append(f"{item}")
        elif isinstance(value, dict):
            if "type" in value and value["type"] == "text":
                for sub_key, sub_item in value["counts"].items():
                    output.append(f"{sub_key}: {sub_item}")
            else:
                for sub_key, sub_item in value.items():
                    output.append(f"{sub_key}")
                    output.append(f"{sub_item}")
        else:
            output.append(f"{value}")
        output.append("-" * 20)
    return "\n".join(output)


def process_survey_file(file_path: Path | str) -> str:
    """Processes a survey spreadsheet file and returns a formatted report string."""
    summary_results = analyze_spreadsheet(file_path)
    return format_summary_to_string(summary_results)


def process_ods_buffer(file_buffer: Any) -> str:
    """Processes an ODS / spreadsheet file buffer and returns a formatted report string."""
    try:
        summary_results = analyze_spreadsheet(file_buffer)
        return format_summary_to_string(summary_results)
    except Exception as e:
        return f"Błąd podczas przetwarzania pliku: {str(e)}"

