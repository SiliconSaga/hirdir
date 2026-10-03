"""Roster tab: the one place player names and jersey numbers are typed in.

No birthdates, no ages. The lineup is already ordered youngest first by the
config loader, which is all the birthdates were ever needed for.
"""

from __future__ import annotations

from openpyxl.utils import get_column_letter as L

from ..config import TeamConfig
from ..layout import FIRST_PLAYER_ROW, SPARE_ROWS
from ..style import BOX, CENTER, GREEN, INPUT_TEXT, LEFT, boxed_range, cell, f, print_setup

HEADERS = ["#", "Player", "Uniform size notes", "Notes"]
WIDTHS = (6, 20, 28, 44)


def build(wb, cfg: TeamConfig):
    ws = wb.active
    ws.title = "Roster"
    title = " · ".join(x for x in (cfg.team, cfg.season, "Roster") if x)
    cell(ws, "A1", title, f(16, True, GREEN))
    cell(
        ws,
        "A2",
        "Write jersey numbers in column A once — every game sheet and the Season tab pick "
        "them up. Order is youngest first (the team bag numbers the smallest kids lowest). "
        "Don't re-sort after the first game: game sheets follow row positions.",
        f(9, italic=True),
        LEFT,
    )
    ws.merge_cells("A2:D2")
    ws.row_dimensions[2].height = 30

    for i, head in enumerate(HEADERS, 1):
        cell(ws, f"{L(i)}4", head, f(10, True, "FFFFFF"), CENTER, BOX, GREEN)

    row = FIRST_PLAYER_ROW
    for player in cfg.players:
        # A config that already knows the numbers prefills them; otherwise the
        # column stays the coach's to fill in, as the note in A2 says.
        jersey = cell(ws, f"A{row}", player.jersey, f(12, True, INPUT_TEXT), CENTER, BOX)
        # A jersey is what is printed on a shirt, never a formula: openpyxl
        # reads a leading '=' as one, and Excel would then evaluate it.
        if player.jersey is not None:
            jersey.data_type = "s"
        cell(ws, f"B{row}", player.name, f(12, True, INPUT_TEXT), LEFT, BOX)
        cell(ws, f"C{row}", None, f(10), LEFT, BOX)
        cell(ws, f"D{row}", None, f(10), LEFT, BOX)
        ws.row_dimensions[row].height = 22
        row += 1
    for spare in range(SPARE_ROWS):
        boxed_range(ws, 1, len(HEADERS), row + spare)
        ws.row_dimensions[row + spare].height = 22

    for i, width in enumerate(WIDTHS, 1):
        ws.column_dimensions[L(i)].width = width
    print_setup(ws)
    return ws
