from collections import Counter
from collections.abc import Sequence
import csv
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

# Polish alphabet collation order mapping
_PL_ORDER = "aąbcćdeęfghijklłmnńoóprsśtuwyzźż"
_PL_TRANSLATION_MAP = {ch: i for i, ch in enumerate(_PL_ORDER)}


def _polish_sort_key(text: str) -> list[int]:
    """Generates a tuple/list of character ranks according to Polish alphabet order."""
    return [_PL_TRANSLATION_MAP.get(ch, ord(ch) + 1000) for ch in text.lower()]


def _participant_sort_key(participant: Participant) -> tuple[list[int], list[int]]:
    """
    Sorts by surname (assumed to always be the 2nd word: name_parts[1]), 
    followed by the remaining parts of the name.
    """
    full_name = participant["imie_nazwisko"].strip()
    name_parts = full_name.split()

    if len(name_parts) > 1:
        surname = name_parts[1]
        # Keep everything else (e.g. first name, 2nd surname/middle names) as secondary tiebreaker
        other_names = " ".join([name_parts[0]] + name_parts[2:])
    else:
        surname = full_name
        other_names = ""

    return (_polish_sort_key(surname), _polish_sort_key(other_names))

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
            "email": "",
            "locked": False,
        })

    participants.sort(key=_participant_sort_key)

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
    path = Path(file_path)
    if path.suffix.lower() == ".csv":
        return parse_participants_csv(read_raw_csv(path))
    raw_data = read_raw_sheet(path)
    return parse_participants(raw_data)


# ============================================================================
# CSV Participant List Parser (e.g. Zoom-style report)
# ============================================================================

# Header labels (normalized) recognized as the participant's first name.
_CSV_FIRST_NAME_KEYS = ("imię", "imie")
# ... last name.
_CSV_LAST_NAME_KEYS = ("nazwisko",)
# ... login/display name fallback.
_CSV_LOGIN_KEYS = ("login",)
# ... primary e-mail column (Polish), then the English fallback.
_CSV_EMAIL_PL_KEYS = ("adres email",)
_CSV_EMAIL_EN_KEYS = ("e-mail", "email")


def _decode_csv_bytes(raw: bytes) -> str:
    """Decodes raw CSV bytes, tolerating Excel-PL encodings and BOMs."""
    for encoding in ("utf-8-sig", "cp1250", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def read_raw_csv(file_path: Path) -> list[list[str]]:
    """Reads a CSV file into a 2D grid, sniffing delimiter and encoding."""
    raw = Path(file_path).read_bytes()
    text = _decode_csv_bytes(raw)

    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel

    reader = csv.reader(io.StringIO(text), dialect)
    return [list(row) for row in reader]


def _norm_csv_key(header: object) -> str:
    """Normalizes a CSV header for resilient, order-independent matching."""
    if header is None:
        return ""
    cleaned = str(header).replace("\ufeff", "")
    return " ".join(cleaned.split()).casefold()


def _csv_cell(row: Sequence[object], col: int | None) -> str:
    """Safely extracts and trims a cell value, treating empties as ''."""
    if col is None or col >= len(row):
        return ""
    value = row[col]
    if value is None:
        return ""
    return str(value).strip()


def _find_csv_column(index: dict[str, int], keys: Sequence[str]) -> int | None:
    for key in keys:
        if key in index:
            return index[key]
    return None


def parse_participants_csv(grid: Sequence[Sequence[object]]) -> list[Participant]:
    """
    Parses a participant CSV grid (e.g. a Zoom registration report).

    Columns are matched by header name, so order does not matter and randomly
    empty cells are tolerated. The participant name is built from Imię/Nazwisko,
    falling back to Login, then e-mail; rows lacking all of these are skipped.
    """
    if not grid:
        return []

    # Header is the first row that contains any non-empty cell.
    header_idx: int | None = None
    for i, row in enumerate(grid):
        if any(str(cell).strip() for cell in row if cell is not None):
            header_idx = i
            break
    if header_idx is None:
        return []

    index: dict[str, int] = {}
    for col, value in enumerate(grid[header_idx]):
        key = _norm_csv_key(value)
        if key and key not in index:
            index[key] = col

    col_first = _find_csv_column(index, _CSV_FIRST_NAME_KEYS)
    col_last = _find_csv_column(index, _CSV_LAST_NAME_KEYS)
    col_login = _find_csv_column(index, _CSV_LOGIN_KEYS)
    col_email_pl = _find_csv_column(index, _CSV_EMAIL_PL_KEYS)
    col_email_en = _find_csv_column(index, _CSV_EMAIL_EN_KEYS)

    if all(c is None for c in (col_first, col_last, col_login, col_email_pl, col_email_en)):
        raise ValueError(
            "Nieprawidłowy format pliku CSV. Brak rozpoznanych kolumn "
            "(Imię, Nazwisko, Login, Adres email lub E-mail)."
        )

    participants: list[Participant] = []
    for row in grid[header_idx + 1:]:
        first = _csv_cell(row, col_first)
        last = _csv_cell(row, col_last)
        login = _csv_cell(row, col_login)
        email = _csv_cell(row, col_email_pl) or _csv_cell(row, col_email_en)

        name = f"{first} {last}".strip()
        if not name:
            name = login
        if not name:
            name = email
        if not name:
            continue

        participants.append({
            "imie_nazwisko": name,
            "data_urodzenia": "",
            "miejsce_urodzenia": "",
            "placowka": "",
            "email": email,
            "locked": False,
        })

    participants.sort(key=_participant_sort_key)
    return participants


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

