from pathlib import Path

from johnmamapdfv2.json_io import load_training_document
from johnmamapdfv2.typst_generator import compile_certificate_pdf


# Locate fixtures relative to this test file
FIXTURES_DIR = Path(__file__).parent / "fixtures"
SAMPLE_DATA_GEN = FIXTURES_DIR / "data_gen.json"


def test_compile_certificate_from_fixture(tmp_path: Path) -> None:
    assert SAMPLE_DATA_GEN.exists(), f"Fixture missing: {SAMPLE_DATA_GEN}"

    # 1. Load typed fixture
    doc = load_training_document(SAMPLE_DATA_GEN)

    # 2. Set an isolated target path in pytest's temporary folder
    out_pdf = tmp_path / "certyfikaty.pdf"

    # 3. Execute generator
    result_path = compile_certificate_pdf(doc, out_pdf)

    # 4. Verify output
    assert result_path.exists()
    assert result_path.is_file()
    assert result_path.stat().st_size > 0
