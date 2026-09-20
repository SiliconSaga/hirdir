"""Season tab: every game's minutes per kid, and what the season adds up to.

Everything here is a formula reading the game sheets, so the coach only ever
types into a game sheet.
"""

from __future__ import annotations

from openpyxl.utils import get_column_letter as L

from ..config import TeamConfig
from ..layout import FIRST_PLAYER_ROW, GameColumns, player_rows
from ..style import BOX, CENTER, GREEN, LEFT, LINK, RIGHT, cell, f, fair_colors, print_setup
from .game import ABSENT

TOTAL_HEADERS = [
    "Games",
    "Missed",
    "Minutes",
    "Min /\ngame",
    "± fair\n(season)",
    "Goals",
    "★",
    "Shy",
    "Needs\nhelp",
]


def build(wb, cfg: TeamConfig, cols: GameColumns, first_game_row: int):
    ws = wb.create_sheet("Season", 1)
    rows = player_rows(cfg)
    games = cfg.games
    n_games = len(games)

    title = " · ".join(x for x in (cfg.team, cfg.season, "Season overview") if x)
    cell(ws, "A1", title, f(16, True, GREEN))
    cell(
        ws,
        "A2",
        "Filled in automatically from the game sheets — edit those, not this. Game columns "
        "show minutes played, or ✓ if the kid came but has no minutes recorded.",
        f(9, italic=True),
        LEFT,
    )

    heads = ["#", "Player"]
    heads += [
        f"G{i + 1}\n{g.date:%b %-d}\n{g.opponent}" for i, g in enumerate(games)
    ] + TOTAL_HEADERS
    for i, head in enumerate(heads, 1):
        cell(ws, f"{L(i)}4", head, f(9, True, "FFFFFF"), CENTER, BOX, GREEN)
    ws.row_dimensions[4].height = 42

    def game_ref(index: int, col: int, row: int) -> str:
        return f"'{cfg.sheet_names[index]}'!{L(col)}{row}"

    first_game_col = 3
    last_game_col = 2 + n_games
    totals_col = 3 + n_games

    for i in range(rows):
        row = FIRST_PLAYER_ROW + i
        roster_row = FIRST_PLAYER_ROW + i
        grow = first_game_row + i
        cell(
            ws,
            f"A{row}",
            f'=IF(Roster!$A${roster_row}="","",Roster!$A${roster_row})',
            f(11, True, LINK),
            CENTER,
            BOX,
        )
        cell(
            ws,
            f"B{row}",
            f'=IF(Roster!$B${roster_row}="","",Roster!$B${roster_row})',
            f(11, True, LINK),
            LEFT,
            BOX,
        )
        for g in range(n_games):
            minutes = game_ref(g, cols.minutes, grow)
            here = game_ref(g, cols.here, grow)
            # minutes if we have them, else ✓ for came, A for away, blank for
            # "nobody wrote anything down"
            c = cell(
                ws,
                f"{L(first_game_col + g)}{row}",
                f"=IF(LEN({minutes})>0,{minutes},"
                f'IF(UPPER({here})="{ABSENT}","{ABSENT}",IF(LEN({here})>0,"✓","")))',
                f(11),
                CENTER,
                BOX,
            )
            c.number_format = "0"

        span = f"{L(first_game_col)}{row}:{L(last_game_col)}{row}"
        games_col = L(totals_col)       # Games
        minutes_col = L(totals_col + 2)  # Minutes — Missed sits between them
        played = f'=COUNT({span})+COUNTIF({span},"✓")'
        cell(ws, f"{games_col}{row}", played, f(11, True), CENTER, BOX)
        mins = ",".join(game_ref(g, cols.minutes, grow) for g in range(n_games))
        fair = ",".join(game_ref(g, cols.fair, grow) for g in range(n_games))
        goals = ",".join(game_ref(g, cols.goals, grow) for g in range(n_games))
        totals = [
            (f'=COUNTIF({span},"{ABSENT}")', f(11), None),              # Missed
            (f"=SUM({mins})", f(11), "0"),                              # Minutes
            (
                f'=IF({games_col}{row}=0,"",{minutes_col}{row}/{games_col}{row})',
                f(11),
                "0.0",
            ),                                                          # Min / game
            (f"=SUM({fair})", f(11, True), "+0;-0;0"),                   # ± fair
            (f"=SUM({goals})", f(11), None),                             # Goals
        ]
        for j, (formula, font, number_format) in enumerate(totals, start=1):
            c = cell(ws, f"{L(totals_col + j)}{row}", formula, font, CENTER, BOX)
            if number_format:
                c.number_format = number_format
        for j, key in enumerate(("star", "shy", "help"), start=len(totals) + 1):
            flag = getattr(cols, key)
            parts = "+".join(f"(LEN({game_ref(g, flag, grow)})>0)" for g in range(n_games))
            cell(ws, f"{L(totals_col + j)}{row}", f"={parts}", f(11), CENTER, BOX)
        ws.row_dimensions[row].height = 22

    last_row = FIRST_PLAYER_ROW + rows - 1
    fair_col = L(totals_col + 4)
    fair_colors(ws, f"{fair_col}{FIRST_PLAYER_ROW}:{fair_col}{last_row}")

    footer = last_row + 1
    cell(ws, f"B{footer}", "Kids at game", f(9, True), RIGHT)
    for g in range(n_games):
        col = L(first_game_col + g)
        span = f"{col}{FIRST_PLAYER_ROW}:{col}{last_row}"
        cell(
            ws,
            f"{col}{footer}",
            f'=COUNT({span})+COUNTIF({span},"✓")',
            f(10, True),
            CENTER,
            BOX,
        )

    ws.column_dimensions["A"].width = 5
    ws.column_dimensions["B"].width = 16
    for i in range(first_game_col, totals_col + len(TOTAL_HEADERS)):
        ws.column_dimensions[L(i)].width = 9
    print_setup(ws)
    return ws
