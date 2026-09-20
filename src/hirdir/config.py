"""Team configuration: the roster and schedule a workbook is built from.

Birthdates are used **only** to order the lineup (youngest first, which
matches how jersey numbers come out of the team bag). They are never written
into the workbook — see docs/plans for the privacy stance.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

MAX_SHEET_NAME = 31


class ConfigError(ValueError):
    """A team config is missing something, or says something impossible."""


@dataclass(frozen=True)
class Player:
    name: str
    dob: date | None = None


@dataclass(frozen=True)
class Game:
    date: date
    opponent: str
    field: str

    @property
    def sheet_name(self) -> str:
        return f"{self.date:%b%-d} {self.opponent}"


@dataclass(frozen=True)
class TeamConfig:
    team: str
    season: str
    players: list[Player]
    games: list[Game]
    on_field: int = 4
    stints: int = 4
    practice_rows: int = 5
    practice_title: str = "PRACTICE — first half of the session"
    sheet_names: list[str] = field(default_factory=list)

    @property
    def first_game(self) -> date | None:
        return self.games[0].date if self.games else None


def _require(data: dict, key: str, where: str):
    if key not in data or data[key] in (None, "", [], {}):
        raise ConfigError(f"{where}: missing '{key}'")
    return data[key]


def _parse_date(value: str, where: str) -> date:
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError) as exc:
        raise ConfigError(f"{where}: '{value}' is not a YYYY-MM-DD date") from exc


def _sheet_names(games: list[Game]) -> list[str]:
    """G1-prefixed, unique, and within Excel's 31-character limit."""
    names = []
    for i, game in enumerate(games, 1):
        name = f"G{i} {game.sheet_name}"[:MAX_SHEET_NAME].strip()
        while name in names:  # pragma: no cover - only two teams could collide
            name = f"{name[: MAX_SHEET_NAME - 2]} {i}"
        names.append(name)
    return names


def order_youngest_first(players: list[Player]) -> list[Player]:
    """Youngest first; players without a birthdate keep their given order, last."""
    dated = [p for p in players if p.dob]
    undated = [p for p in players if not p.dob]
    return sorted(dated, key=lambda p: p.dob, reverse=True) + undated


def load(path: str | Path) -> TeamConfig:
    path = Path(path)
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise ConfigError(f"{path}: not valid JSON ({exc})") from exc
    return parse(data, where=str(path))


def parse(data: dict, where: str = "config") -> TeamConfig:
    players = [
        Player(
            name=str(_require(p, "name", f"{where}: player {i + 1}")),
            dob=_parse_date(p["dob"], f"{where}: {p.get('name', f'player {i + 1}')}")
            if p.get("dob")
            else None,
        )
        for i, p in enumerate(_require(data, "players", where))
    ]
    games = []
    for i, g in enumerate(_require(data, "games", where)):
        at = f"{where}: game {i + 1}"
        games.append(
            Game(
                date=_parse_date(_require(g, "date", at), at),
                opponent=str(_require(g, "opponent", at)),
                field=str(g.get("field", "")),
            )
        )
    on_field = int(data.get("on_field", 4))
    stints = int(data.get("stints", 4))
    if on_field < 1:
        raise ConfigError(f"{where}: 'on_field' must be at least 1")
    if stints < 1:
        raise ConfigError(f"{where}: 'stints' must be at least 1")
    return TeamConfig(
        team=str(_require(data, "team", where)),
        season=str(data.get("season", "")),
        players=order_youngest_first(players),
        games=games,
        on_field=on_field,
        stints=stints,
        practice_rows=int(data.get("practice_rows", 5)),
        practice_title=str(data.get("practice_title", TeamConfig.practice_title)),
        sheet_names=_sheet_names(games),
    )
