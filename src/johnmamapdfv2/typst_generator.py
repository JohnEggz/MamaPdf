import json
import shutil
import tempfile
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


def _replace_directory(staging_dir: Path, target_dir: Path) -> None:
    """
    Replaces the contents of target_dir with staging_dir.

    The existing target_dir is renamed aside first, so if promoting the new set
    fails (for example, a certificate from the previous run is still open in a
    PDF viewer) the previous set is restored rather than half-deleted.
    """
    backup_dir: Path | None = None
    if target_dir.exists():
        backup_dir = target_dir.with_name(f".{target_dir.name}.old")
        if backup_dir.exists():
            shutil.rmtree(backup_dir, ignore_errors=True)
        target_dir.rename(backup_dir)

    try:
        staging_dir.rename(target_dir)
    except OSError:
        if backup_dir is not None and not target_dir.exists():
            backup_dir.rename(target_dir)
        raise
    else:
        if backup_dir is not None:
            shutil.rmtree(backup_dir, ignore_errors=True)


def compile_certificates_individual(doc: TrainingDocument, output_dir: Path) -> list[Path]:
    """
    Compiles one certificate PDF per participant into output_dir.

    The directory is fully app-owned and regenerated on every call: a complete
    new set is compiled in a staging directory and then swapped in, so files
    from previous runs (removed, reordered or renamed participants) can never
    linger as stale duplicates.
    """
    participants = doc.get("participants", [])
    total = len(participants)
    output_dir = Path(output_dir)

    if total == 0:
        # No participants: clear any stale certificates from a previous run.
        if output_dir.exists():
            shutil.rmtree(output_dir, ignore_errors=True)
        return []

    output_dir.parent.mkdir(parents=True, exist_ok=True)
    training_str = json.dumps(doc["training"], ensure_ascii=False)

    # Compile everything into an isolated staging directory first.
    staging_dir = Path(
        tempfile.mkdtemp(prefix=f".{output_dir.name}.tmp-", dir=output_dir.parent)
    )

    results: list[Path] = []
    try:
        for index, participant in enumerate(participants, start=1):
            out_pdf = staging_dir / build_certificate_filename(index, total, participant)
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

        # Promote the completed set into place.
        _replace_directory(staging_dir, output_dir)
    except Exception:
        shutil.rmtree(staging_dir, ignore_errors=True)
        raise

    # Staging was moved into place; report the final paths.
    return [output_dir / path.name for path in results]


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

