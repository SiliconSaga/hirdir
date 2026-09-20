"""Activities tab: the practice-drill library the game sheets pick from.

Seeded with what worked for the Little Kickers last season plus well-known
drills. Phase 2 moves this into a database so activities can be suggested per
team and rated over time; for now the coach edits the tab.
"""

from __future__ import annotations

from openpyxl.utils import get_column_letter as L

from ..style import BOX, CENTER, GREEN, LEFT, boxed_range, cell, f, print_setup

HEADERS = ["Activity", "Type", "Ages", "How it works", "Source", "Tried on",
           "Liked (+ ~ −)", "Useful (+ ~ −)", "Notes"]
WIDTHS = (30, 9, 7, 60, 18, 12, 10, 10, 30)
BLANK_ROWS = 10
FIRST_ROW = 5

SEED = [
    ("Red Light, Green Light (+ colors)", "Game", "LK+",
     "Dribble on green, foot on the ball on red. Add a new color each week: yellow = tiptoe "
     "dribble, blue = turn around, purple = sit on the ball…",
     "Last season favorite"),
    ("Hit the Coach", "Game", "LK+",
     "Coach jogs around the area; kids dribble close and try to hit the coach below the knees "
     "with the ball. Coach ham-acts every hit.",
     "Last season favorite"),
    ("Kids vs Parents cone circle", "Game", "LK+",
     "Kids inside a circle of cones kick balls out; parents outside kick them back in. Great "
     "finisher after the cone-circle dribble.",
     "Last season favorite"),
    ("Cone-circle dribble + shots", "Skill", "LK+",
     "Dribble in and out between the circle's cones; on the coach's call, break off and take a "
     "shot at the goal, then rejoin.",
     "Last season (lead-in)"),
    ("Sharks and Minnows", "Game", "LK+",
     "Minnows dribble across the area; one or two sharks (coach at first) try to kick their ball "
     "out. Caught minnows become sharks.",
     "Classic"),
    ("Coach Says (body-part touches)", "Warm-up", "LK+",
     "Simon Says with the ball: “Coach says touch it with your knee / sole / elbow!” Teaches ball "
     "control and listening.",
     "Classic"),
    ("Pirate Treasure", "Game", "LK+",
     "Every kid dribbles their “treasure”; coach-pirates try to steal balls into their ship (a "
     "cone square). Kids can steal them back.",
     "Classic"),
    ("Dribble the Gates", "Skill", "LK+",
     "Scatter pairs of cones as gates; kids count how many gates they dribble through in a "
     "minute. Beat your own score next round.",
     "Classic"),
    ("What Time Is It, Mr. Wolf?", "Game", "LK+",
     "Kids dribble toward the coach-wolf as he calls times; at “Dinner time!” they dribble back "
     "home before being tagged.",
     "Classic"),
    ("Shooting gallery", "Skill", "LK+",
     "Line of balls a few steps from the goal; kids take turns shooting, fetch their ball, rejoin "
     "the line. Keep lines short.",
     "Classic"),
]


def build(wb) -> str:
    """Build the tab and return the range game sheets use as a drop-down list."""
    ws = wb.create_sheet("Activities")
    cell(ws, "A1", "Practice activities", f(16, True, GREEN))
    cell(
        ws,
        "A2",
        "Add your own rows below. Game sheets offer this list as a drop-down in the practice "
        "section (you can still type anything).",
        f(9, italic=True),
        LEFT,
    )
    for i, head in enumerate(HEADERS, 1):
        cell(ws, f"{L(i)}4", head, f(10, True, "FFFFFF"), CENTER, BOX, GREEN)
    for row, (name, kind, ages, how, source) in enumerate(SEED, FIRST_ROW):
        values = (name, kind, ages, how, source, None, None, None, None)
        for i, value in enumerate(values, 1):
            align = LEFT if i in (1, 4, 9) else CENTER
            cell(ws, f"{L(i)}{row}", value, f(10, bold=(i == 1)), align, BOX)
        ws.row_dimensions[row].height = 42
    blank_start = FIRST_ROW + len(SEED)
    for row in range(blank_start, blank_start + BLANK_ROWS):
        boxed_range(ws, 1, len(HEADERS), row)
    for i, width in enumerate(WIDTHS, 1):
        ws.column_dimensions[L(i)].width = width
    print_setup(ws)
    return f"Activities!$A${FIRST_ROW}:$A${blank_start + BLANK_ROWS - 1}"
