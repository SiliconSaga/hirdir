"""Cache computed values into a workbook's formula cells.

openpyxl saves formulas with no cached value, so anything that doesn't
recalculate — Quick Look, phone previews, pandas — shows blanks or zeros.
Google Sheets and Excel recalculate on open either way; this is for the
previews. Formulas are left untouched; only the <v> element is filled in.

Needs the `formulas` package (a dev dependency): `uv run hirdir build --bake`.
"""

from __future__ import annotations

import re
import zipfile
from html import escape
from pathlib import Path

CELL_WITH_EMPTY_VALUE = re.compile(r'<c r="([A-Z]+\d+)"((?: s="\d+")?)><f>(.*?)</f><v\s*/></c>')
SHEET_TAG = re.compile(r'<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"')
RELATIONSHIP = re.compile(r"<Relationship[^>]*>")
REL_ID = re.compile(r'Id="([^"]+)"')
REL_TARGET = re.compile(r'Target="([^"]+)"')
CELL_KEY = re.compile(r"'\[[^\]]+\](.+)'!([A-Z]+\d+)$")


class BakeError(RuntimeError):
    pass


def _values(path: Path) -> dict[tuple[str, str], object]:
    try:
        import formulas
    except ImportError as exc:  # pragma: no cover - depends on the install
        raise BakeError(
            "baking needs the 'formulas' package — install the dev group (uv sync) "
            "or build with --no-bake"
        ) from exc
    solution = formulas.ExcelModel().loads(str(path)).finish().calculate()
    out: dict[tuple[str, str], object] = {}
    for key, value in solution.items():
        match = CELL_KEY.match(key)
        if not match:
            continue
        cell_value = value.value[0, 0] if hasattr(value, "value") else value
        out[(match.group(1).upper(), match.group(2))] = cell_value
    return out


def _render(ref: str, attrs: str, formula: str, value) -> str:
    if isinstance(value, str):
        text = escape(value, quote=False)
        return f'<c r="{ref}"{attrs} t="str"><f>{formula}</f><v>{text}</v></c>'
    if isinstance(value, bool):
        return f'<c r="{ref}"{attrs} t="b"><f>{formula}</f><v>{int(value)}</v></c>'
    number = float(value)
    text = str(int(number)) if number.is_integer() else repr(number)
    return f'<c r="{ref}"{attrs}><f>{formula}</f><v>{text}</v></c>'


def bake(path: str | Path) -> int:
    """Fill in cached values in place. Returns how many cells were written."""
    path = Path(path)
    values = _values(path)
    with zipfile.ZipFile(path) as zf:
        parts = {name: zf.read(name) for name in zf.namelist()}

    rels = parts["xl/_rels/workbook.xml.rels"].decode()
    targets = {}
    for rel in RELATIONSHIP.findall(rels):
        rel_id, target = REL_ID.search(rel), REL_TARGET.search(rel)
        if rel_id and target:
            targets[rel_id.group(1)] = target.group(1)

    written = 0
    for name, rel_id in SHEET_TAG.findall(parts["xl/workbook.xml"].decode()):
        target = targets[rel_id].lstrip("/")
        part = target if target.startswith("xl/") else f"xl/{target}"
        sheet = name.replace("&amp;", "&").upper()

        def substitute(match: re.Match, sheet=sheet) -> str:
            nonlocal written
            ref, attrs, formula = match.group(1), match.group(2), match.group(3)
            value = values.get((sheet, ref))
            if value is None:
                return match.group(0)
            written += 1
            return _render(ref, attrs, formula, value)

        parts[part] = CELL_WITH_EMPTY_VALUE.sub(substitute, parts[part].decode()).encode()

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in parts.items():
            zf.writestr(name, data)
    return written
