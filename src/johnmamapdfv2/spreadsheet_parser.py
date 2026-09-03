from collections.abc import Sequence
from python_calamine import CalamineWorkbook
from pathlib import Path
from johnmamapdfv2.types import Participant
import re

def read_raw_sheet(file_path: Path):
    workbook = CalamineWorkbook.from_path(file_path) # pyright: ignore[reportUnknownMemberType]
    if not workbook.sheet_names:
        raise ValueError(f"Workbook has no sheets: {file_path}")
    sheet_name = workbook.sheet_names[0]
    return workbook.get_sheet_by_name(sheet_name).to_python()

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
        
    try: day = int(parts[0])
    except ValueError: day = 1
        
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
        try: month = int(month_raw)
        except ValueError: month = 1
        
    year_raw = parts[2]
    if len(year_raw) == 2:
        year = f"19{year_raw}" if int(year_raw) > 30 else f"20{year_raw}"
    else:
        year = year_raw
        
    return f"{day:02d}.{month:02d}.{year}"

def _normalize_location(raw: str) -> str:
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

# def _polish_sort_weight(c: str) -> int:
#     weights = {'a': 10, 'ą': 20, 'b': 30, 'c': 40, 'ć': 50, 'd': 60, 'e': 70, 'ę': 80, 'f': 90, 'g': 100, 'h': 110, 'i': 120, 'j': 130, 'k': 140, 'l': 150, 'ł': 160, 'm': 170, 'n': 180, 'ń': 190, 'o': 200, 'ó': 210, 'p': 220, 'r': 230, 's': 240, 'ś': 250, 't': 260, 'u': 270, 'w': 280, 'y': 290, 'z': 300, 'ź': 310, 'ż': 320}
#     return weights.get(c.lower(), 1000 + ord(c))

def load_participants(file_path: Path) -> list[Participant]:
    raw_data = read_raw_sheet(file_path)
    return parse_participants(raw_data)
