"""Where things sit on a game sheet.

The Season tab reads the game sheets cell by cell, so both sides have to agree
on the column map and on the first roster row. This module is the one place
those numbers are decided.
"""

from __future__ import annotations

from dataclasses import dataclass

from .config import TeamConfig

# Roster rows start below the header on every sheet that lists players.
FIRST_PLAYER_ROW = 5

# Blank rows kept after the roster: a late sign-up typed into the Roster tab
# then shows up on every game sheet and in the Season tab without a rebuild.
SPARE_ROWS = 2


def player_rows(cfg: TeamConfig) -> int:
    return len(cfg.players) + SPARE_ROWS


# Settings row (row 3) of a game sheet: "Game ended at minute:" and "Players
# per side:" are typed in, "Fair share per kid:" is computed from them. Label
# and value spans are measured from the real column widths (see
# settings_cells) because a label merged too narrow spills over its neighbour,
# and the columns shift with a team's stint count.
SETTINGS_ROW = 3
BOLD_CHAR = 1.12  # bold text needs a bit more room per character than a width unit
VALUE_WIDTH = 8.0  # room for a typed number, or "12.5 min"


@dataclass(frozen=True)
class GameColumns:
    here: int
    num: int
    name: int
    stints: tuple[tuple[int, int], ...]  # (In, Out) pairs
    minutes: int
    fair: int
    goals: int
    star: int
    shy: int
    help: int
    notes: int

    @property
    def last(self) -> int:
        return self.notes

    @property
    def first_stint_col(self) -> int:
        return self.stints[0][0]

    @property
    def last_stint_col(self) -> int:
        return self.stints[-1][1]


@dataclass(frozen=True)
class SettingsField:
    """One label + value pair in the settings row, as column spans."""

    label: str
    label_span: tuple[int, int]
    value_span: tuple[int, int]

    @property
    def value_ref(self) -> str:
        """Absolute reference to the value cell, for use inside formulas."""
        from openpyxl.utils import get_column_letter

        return f"${get_column_letter(self.value_span[0])}${SETTINGS_ROW}"


def _plan_settings(
    widths: dict[int, float], labels: list[str], value_width: float, gap: int
) -> list[SettingsField]:
    fields = []
    col = 1
    for label in labels:
        start, span = col, 0.0
        while span < len(label) * BOLD_CHAR:
            span += widths.get(col, 8.0)
            col += 1
        label_span = (start, col - 1)
        start, span = col, 0.0
        while span < value_width:
            span += widths.get(col, 8.0)
            col += 1
        fields.append(SettingsField(label, label_span, (start, col - 1)))
        col += gap
    return fields


def settings_cells(widths: dict[int, float], labels: list[str]) -> list[SettingsField]:
    """Lay the settings row out left to right, widening spans to fit the text.

    Tightens the spacing rather than running past the last grid column, which
    would widen the printed page by a column that holds nothing.
    """
    last_col = max(widths)
    for value_width, gap in ((VALUE_WIDTH, 1), (VALUE_WIDTH, 0), (0.1, 0)):
        fields = _plan_settings(widths, labels, value_width, gap)
        if fields[-1].value_span[1] <= last_col:
            return fields
    return fields  # nothing fits cleanly; the tightest plan is the best we can do


def game_columns(cfg: TeamConfig) -> GameColumns:
    col = 4
    stints = []
    for _ in range(cfg.stints):
        stints.append((col, col + 1))
        col += 2
    fields = {}
    for key in ("minutes", "fair", "goals", "star", "shy", "help", "notes"):
        fields[key] = col
        col += 1
    return GameColumns(here=1, num=2, name=3, stints=tuple(stints), **fields)
