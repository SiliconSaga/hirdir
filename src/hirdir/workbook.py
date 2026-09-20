"""Assemble a team's season workbook: Roster, Season, a sheet per game, Activities."""

from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook

from .config import TeamConfig
from .layout import game_columns
from .sheets import activities, game, roster, season


def build(cfg: TeamConfig) -> Workbook:
    wb = Workbook()
    roster.build(wb, cfg)
    activity_ref = activities.build(wb)
    cols = game_columns(cfg)
    first_game_row = 0
    for index, match in enumerate(cfg.games):
        first_game_row = game.build(wb, cfg, index, match, cols, activity_ref)
    season.build(wb, cfg, cols, first_game_row)
    wb.move_sheet("Activities", offset=len(wb.sheetnames))
    wb.calculation.fullCalcOnLoad = True
    return wb


def write(cfg: TeamConfig, path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    build(cfg).save(path)
    return path
