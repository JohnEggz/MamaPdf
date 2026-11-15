from pathlib import Path

from johnmamapdfv2.json_io import load_training_document
from johnmamapdfv2.typst_generator import (
    build_certificate_filename,
    compile_certificate_pdf,
    compile_certificates_individual,
)
from johnmamapdfv2.types import Participant


# Locate fixtures relative to this test file
FIXTURES_DIR = Path(__file__).parent / "fixtures"
SAMPLE_DATA_GEN = FIXTURES_DIR / "data_gen.json"


def _participant(name: str, email: str = "") -> Participant:
    return {
        "imie_nazwisko": name,
        "data_urodzenia": "",
        "miejsce_urodzenia": "",
        "placowka": "",
        "email": email,
        "locked": False,
    }


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


def test_compile_certificates_individual(tmp_path: Path) -> None:
    doc = load_training_document(SAMPLE_DATA_GEN)
    out_dir = tmp_path / "zaswiadczenia"

    paths = compile_certificates_individual(doc, out_dir)

    assert len(paths) == 3
    assert sorted(p.name for p in paths) == [
        "01_John_Doe.pdf",
        "02_John_Doe.pdf",
        "03_John_Doe.pdf",
    ]
    for path in paths:
        assert path.parent == out_dir
        assert path.exists()
        assert path.stat().st_size > 0


def test_build_certificate_filename_zero_padding_and_email() -> None:
    total = 12
    assert (
        build_certificate_filename(1, total, _participant("Jan Kowalski", "jan@x.com"))
        == "01_Jan_Kowalski_jan@x.com.pdf"
    )
    assert (
        build_certificate_filename(12, total, _participant("Jan Kowalski"))
        == "12_Jan_Kowalski.pdf"
    )


def test_build_certificate_filename_min_two_digit_padding() -> None:
    assert build_certificate_filename(1, 3, _participant("John Doe")) == "01_John_Doe.pdf"


def test_build_certificate_filename_multi_token_name() -> None:
    assert (
        build_certificate_filename(1, 1, _participant("Jan Maria Kowalski"))
        == "01_Jan_Maria_Kowalski.pdf"
    )


def test_build_certificate_filename_sanitizes_illegal_chars() -> None:
    filename = build_certificate_filename(1, 1, _participant("Jan/Kowalski", "a?b@x.com"))
    assert filename == "01_Jan_Kowalski_a_b@x.com.pdf"
    assert all(ch not in filename for ch in '<>:"/\\|?*')


def test_regeneration_purges_stale_certificates(tmp_path: Path) -> None:
    out_dir = tmp_path / "zaswiadczenia"
    doc = load_training_document(SAMPLE_DATA_GEN)
    assert len(compile_certificates_individual(doc, out_dir)) == 3

    # Simulate removing a participant, then regenerating.
    doc["participants"] = doc["participants"][:2]
    paths = compile_certificates_individual(doc, out_dir)

    assert sorted(p.name for p in paths) == ["01_John_Doe.pdf", "02_John_Doe.pdf"]
    # No stale third certificate, and no temp/backup directories left behind.
    assert sorted(p.name for p in out_dir.iterdir()) == ["01_John_Doe.pdf", "02_John_Doe.pdf"]
    assert not [p for p in tmp_path.iterdir() if p.name.startswith(".zaswiadczenia")]


def test_regeneration_with_no_participants_clears_directory(tmp_path: Path) -> None:
    out_dir = tmp_path / "zaswiadczenia"
    doc = load_training_document(SAMPLE_DATA_GEN)
    compile_certificates_individual(doc, out_dir)
    assert list(out_dir.iterdir())

    doc["participants"] = []
    assert compile_certificates_individual(doc, out_dir) == []
    assert not out_dir.exists() or not list(out_dir.iterdir())
