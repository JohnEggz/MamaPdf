import ezodf
from statistics import mean
from collections import Counter
import io

# Expected keys/headers for validation
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

def validate_columns(headers: list) -> bool:
    """Checks if all required columns are present in the headers."""
    required = list(KEYS_AVERAGE) + [KEY_LISTA, KEY_TAK_NIE, KEY_SORTING]
    for req in required:
        if req not in headers:
            return False, req
    return True, None

def analyze_spreadsheet(spreadsheet) -> dict:
    """Core analysis logic extracted from your original file-reading function"""
    if len(spreadsheet.sheets) != 1:
        raise ValueError("Plik ODS musi zawierać dokładnie jeden arkusz.")
    
    sheet = spreadsheet.sheets[0]

    headers = [
        str(sheet[0, c].value)
        for c in range(sheet.ncols())
        if sheet[0, c].value is not None
    ]

    is_valid, missing_col = validate_columns(headers)
    if not is_valid:
        raise ValueError(f"Nieprawidłowy format pliku. Brakująca kolumna: '{missing_col}'")

    columns = {h: [] for h in headers}
    for r in range(1, sheet.nrows()):
        for c, header in enumerate(headers):
            value = sheet[r, c].value
            if value is not None:
                columns[header].append(value)

    summary = {}
    for header, values in columns.items():
        if header == "Sygnatura czasowa":
            continue
        elif header in KEYS_AVERAGE:
            numeric_values = []
            for v in values:
                try:
                    numeric_values.append(float(v))
                except (TypeError, ValueError):
                    pass
            if numeric_values:
                summary[header] = round(mean(numeric_values), 1)
            else:
                summary[header] = "N/A (Brak poprawnych danych liczbowych)"

        elif header == KEY_LISTA:
            new_items = []
            for value in values:
                new_items.append(str(value).replace("\n", ""))
            summary[header] = new_items
        elif header == KEY_TAK_NIE:
            tak, nie_wiem, nie = 0, 0, 0
            for value in values:
                value_str = str(value)
                if value_str == "Tak": tak += 1
                elif value_str == "Nie wiem": nie_wiem += 1
                elif value_str == "Nie": nie += 1
            summary[header] = {"Tak": tak, "Nie wiem": nie_wiem, "Nie": nie}
        elif header == KEY_SORTING:
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
                "counts": dict(Counter(str(v) for v in values)),
            }
    return summary

def format_summary_to_string(summary_data: dict) -> str:
    """Formats the data into a plain-text report."""
    output = []
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

def process_ods_buffer(file_buffer) -> str:
    """Processes an ODS file buffer and returns a formatted report string."""
    try:
        spreadsheet = ezodf.opendoc(file_buffer)
        summary_results = analyze_spreadsheet(spreadsheet)
        return format_summary_to_string(summary_results)
    except Exception as e:
        return f"Błąd podczas przetwarzania pliku: {str(e)}"

if __name__ == "__main__":
    # For standalone testing
    import sys
    if len(sys.argv) > 1:
        path = sys.argv[1]
        with open(path, 'rb') as f:
            print(process_ods_buffer(io.BytesIO(f.read())))
