import json
from pathlib import Path
from typing import TypedDict
import typst

from johnmamapdfv2.paths import ASSETS_DIR, CERTIFICATE_TEMPLATE, ATTENDANCE_TEMPLATE
from johnmamapdfv2.storage import sanitize_filename_component
from johnmamapdfv2.types import Participant, TrainingDocument


class CompiledDocuments(TypedDict):
    certificate: Path
    attendance: Path
    certificates_dir: Path
    individual_certificates: list[Path]


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


def build_certificate_filename(index: int, total: int, participant: Participant) -> str:
    """
    Builds '<NN>_<Imię>_<Nazwisko>_<email>.pdf' from sanitized, non-empty parts.

    The ordinal is zero-padded to at least two digits; empty name/email segments
    are omitted so the filename stays clean.
    """
    width = max(2, len(str(total)))
    parts: list[str] = [str(index).zfill(width)]

    name_parts = str(participant.get("imie_nazwisko", "")).split()
    if name_parts:
        parts.append(name_parts[0])
        if len(name_parts) > 1:
            parts.append(" ".join(name_parts[1:]))

    email = str(participant.get("email", "")).strip()
    if email:
        parts.append(email)

    stem = "_".join(
        component
        for component in (sanitize_filename_component(p) for p in parts)
        if component
    )
    return f"{stem}.pdf"


def compile_certificates_individual(doc: TrainingDocument, output_dir: Path) -> list[Path]:
    """Compiles one certificate PDF per participant into output_dir."""
    participants = doc.get("participants", [])
    total = len(participants)
    if total == 0:
        return []

    output_dir.mkdir(parents=True, exist_ok=True)
    training_str = json.dumps(doc["training"], ensure_ascii=False)

    results: list[Path] = []
    for index, participant in enumerate(participants, start=1):
        out_pdf = output_dir / build_certificate_filename(index, total, participant)
        _ = typst.compile(
            input=CERTIFICATE_TEMPLATE,
            output=out_pdf,
            root=ASSETS_DIR,
            font_paths=[ASSETS_DIR],
            sys_inputs={
                "training": training_str,
                "participants": json.dumps([participant], ensure_ascii=False),
            },
        )
        results.append(out_pdf)
    return results


def compile_all_documents(doc: TrainingDocument, output_dir: Path) -> CompiledDocuments:
    """Compiles both certificate and attendance PDFs into output directory."""
    output_dir.mkdir(parents=True, exist_ok=True)
    cert_path = output_dir / "certyfikaty.pdf"
    attendance_path = output_dir / "lista_obecnosci.pdf"
    compile_certificate_pdf(doc, cert_path)
    compile_attendance_pdf(doc, attendance_path)

    certificates_dir = output_dir / "zaswiadczenia"
    individual = compile_certificates_individual(doc, certificates_dir)

    return {
        "certificate": cert_path,
        "attendance": attendance_path,
        "certificates_dir": certificates_dir,
        "individual_certificates": individual,
    }

