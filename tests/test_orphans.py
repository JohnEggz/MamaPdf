from pathlib import Path
import shutil

import typst

from johnmamapdfv2.paths import ASSETS_DIR


ORPHANS_MODULE = ASSETS_DIR / "orphans.typ"
NBSP = "\u00a0"


def _compile_html(tmp_path: Path, source: str) -> str:
    """Copy the orphans module next to `source` and compile it to HTML."""
    shutil.copy(ORPHANS_MODULE, tmp_path / "orphans.typ")
    doc = tmp_path / "doc.typ"
    doc.write_text(source, encoding="utf-8")
    return typst.compile(doc, format="html", root=tmp_path).decode("utf-8")


def test_show_rule_glues_orphan_words(tmp_path: Path) -> None:
    html = _compile_html(
        tmp_path,
        "\n".join(
            [
                '#import "orphans.typ": orphan-regex, orphan-replacement',
                "#show orphan-regex: orphan-replacement",
                "Ala i Ola w domu, a kot z psem.",
                "Wpisano w dniu 1 r. oraz i nr 5.",
            ]
        ),
    )

    # Orphan words are followed by a non-breaking space...
    assert f"i{NBSP}Ola" in html
    assert f"w{NBSP}domu" in html
    assert f"a{NBSP}kot" in html
    assert f"z{NBSP}psem" in html
    assert f"r.{NBSP}oraz" in html
    assert f"i{NBSP}nr" in html

    # ...while the space *before* the orphan word is left as a normal space.
    assert f"Ala i{NBSP}Ola" in html


def test_show_rule_does_not_touch_longer_words(tmp_path: Path) -> None:
    html = _compile_html(
        tmp_path,
        "\n".join(
            [
                '#import "orphans.typ": orphan-regex, orphan-replacement',
                "#show orphan-regex: orphan-replacement",
                "iść wspaniały nafta żeberko dom.",
            ]
        ),
    )

    # Nothing should have been glued: these are whole words, not orphans.
    assert NBSP not in html
    for word in ("iść", "wspaniały", "nafta", "żeberko", "dom"):
        assert word in html


def test_fix_orphans_str(tmp_path: Path) -> None:
    html = _compile_html(
        tmp_path,
        "\n".join(
            [
                '#import "orphans.typ": fix-orphans-str',
                '#text(fix-orphans-str("Ala i Ola w domu"))',
            ]
        ),
    )
    assert f"i{NBSP}Ola" in html
    assert f"w{NBSP}domu" in html


def test_manual_marker_in_string(tmp_path: Path) -> None:
    html = _compile_html(
        tmp_path,
        "\n".join(
            [
                '#import "orphans.typ": fix-orphans-str',
                '#text(fix-orphans-str("Anna~Kowalska oraz Jan"))',
            ]
        ),
    )
    assert f"Anna{NBSP}Kowalska" in html
    # `~` is consumed; no tilde should remain.
    assert "~" not in html


def test_manual_marker_through_show_rule(tmp_path: Path) -> None:
    html = _compile_html(
        tmp_path,
        "\n".join(
            [
                '#import "orphans.typ": orphan-regex, orphan-replacement',
                "#show orphan-regex: orphan-replacement",
                '#let name = "Anna~Kowalska"',
                "#name spotkała się z Janem.",
            ]
        ),
    )
    assert f"Anna{NBSP}Kowalska" in html
    assert "~" not in html


def test_glue_and_nbsp_join_helpers(tmp_path: Path) -> None:
    html = _compile_html(
        tmp_path,
        "\n".join(
            [
                '#import "orphans.typ": glue, nbsp-join',
                '#text(glue("Anna", "Kowalska"))',
                '#text(" i ")',
                '#text(nbsp-join(("Jan", "Nowak")))',
            ]
        ),
    )
    assert f"Anna{NBSP}Kowalska" in html
    assert f"Jan{NBSP}Nowak" in html


def test_fix_orphans_is_scoped(tmp_path: Path) -> None:
    html = _compile_html(
        tmp_path,
        "\n".join(
            [
                '#import "orphans.typ": fix-orphans',
                "#fix-orphans[Wnętrze a i w na.]",
                "Na zewnątrz a i w na.",
            ]
        ),
    )
    # Inside the wrapper: glued.
    assert f"a{NBSP}i{NBSP}w{NBSP}na" in html
    # Outside the wrapper: untouched.
    assert "Na zewnątrz a i w na." in html
