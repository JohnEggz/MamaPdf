"""
Deprecated survey parser module.
Functionality has been ported to johnmamapdfv2.spreadsheet_parser.
Re-exported here for backward compatibility.
"""

from johnmamapdfv2.spreadsheet_parser import (
    KEYS_AVERAGE,
    KEY_LISTA,
    KEY_TAK_NIE,
    KEY_SORTING,
    MULTI_CHOICE_KEY,
    validate_columns,
    analyze_spreadsheet,
    format_summary_to_string,
    process_ods_buffer,
    process_survey_file,
)

if __name__ == "__main__":
    import io
    import sys
    if len(sys.argv) > 1:
        path = sys.argv[1]
        with open(path, "rb") as f:
            print(process_ods_buffer(io.BytesIO(f.read())))

