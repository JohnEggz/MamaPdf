import json
from pathlib import Path
import typst

from johnmamapdfv2.paths import ASSETS_DIR, CERTIFICATE_TEMPLATE, ATTENDANCE_TEMPLATE
from johnmamapdfv2.types import TrainingDocument


def compile_certificate_pdf(doc: TrainingDocument, output_pdf: Path) -> Path:
    """Compiles the certificate PDF using bundled assets and templates."""
    output_pdf.parent.mkdir(parents=True, exist_ok=True)

    training_str = json.dumps(doc["training"], ensure_ascii=False)
    participants_str = json.dumps(doc["participants"], ensure_ascii=False)

    _ = typst.compile(
        input=CERTIFICATE_TEMPLATE,
        output=output_pdf,
        root=ASSETS_DIR,
        font_paths=[ASSETS_DIR],
        sys_inputs={
            "training": training_str,
            "participants": participants_str,
        },
    )
    return output_pdf


def compile_attendance_pdf(doc: TrainingDocument, output_pdf: Path) -> Path:
    """Compiles the attendance list PDF using bundled assets and templates."""
    output_pdf.parent.mkdir(parents=True, exist_ok=True)

    training_str = json.dumps(doc["training"], ensure_ascii=False)
    participants_str = json.dumps(doc["participants"], ensure_ascii=False)

    _ = typst.compile(
        input=ATTENDANCE_TEMPLATE,
        output=output_pdf,
        root=ASSETS_DIR,
        font_paths=[ASSETS_DIR],
        sys_inputs={
            "training": training_str,
            "participants": participants_str,
        },
    )
    return output_pdf


def compile_all_documents(doc: TrainingDocument, output_dir: Path) -> dict[str, Path]:
    """Compiles both certificate and attendance PDFs into output directory."""
    output_dir.mkdir(parents=True, exist_ok=True)
    cert_path = output_dir / "certyfikaty.pdf"
    attendance_path = output_dir / "lista_obecnosci.pdf"
    compile_certificate_pdf(doc, cert_path)
    compile_attendance_pdf(doc, attendance_path)
    return {
        "certificate": cert_path,
        "attendance": attendance_path,
    }

