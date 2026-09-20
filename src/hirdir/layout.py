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

# Settings row (row 3) of a game sheet: label spans, then the cell itself.
# Kept in the low columns so the row doesn't depend on how many stints a
# team's sheet has.
SETTINGS_ROW = 3
END_MINUTE = "$D$3"        # typed in after the game
PLAYERS_PER_SIDE = "$H$3"  # typed in (defaults to the config's on_field)
FAIR_SHARE = "$L$3"        # formula: end minute × players per side ÷ kids here
MIN_COLUMNS = 13           # the settings row needs this many columns


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
