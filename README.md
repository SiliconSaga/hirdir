# Hirðir

*Old Norse **hirðir**, "herdsman" — which is most of what coaching a Little Kickers team involves.*

A coaching tool for [Mountain Top League](https://soccer.mountaintopleague.com/) youth soccer. It exists to answer three questions a volunteer coach cannot answer from memory during a game:

- **Who has had the least field time?** Playing time should be roughly even, and at 4v4 with ten five-year-olds it drifts fast.
- **Who needs more of my attention?** The confident kids are fine with less; the shy or struggling ones are why you are there.
- **What should we do in practice?** Especially for the youngest groups, where the session is half practice.

## Phases

| Phase | What | Where team data lives |
|---|---|---|
| **0 — here now** | A printable `.xlsx` per team: one sheet per game recording field time as stopwatch minutes in and out, plus goals, ★/shy/needs-help flags and a practice plan | A gitignored directory on the coach's machine |
| **1** | A static coach page: tap a kid to sub them in or out, with live field-time clocks; browser storage only | The coach's browser |
| **2** | A backend on the cluster with coach login and player history across seasons | Postgres, behind login |
| **3** | Roster balancing for the league, using past-season history so one team doesn't get five stars and another five shy kids | Same |

See [`docs/plans/2026-09-19-hirdir-phases-design.md`](docs/plans/2026-09-19-hirdir-phases-design.md) for the design and the open questions.

## Team data never enters this repo

Rosters name children. The only roster committed here is [`examples/example-team.json`](examples/example-team.json), whose names are invented.

- Real team configs and generated workbooks go in `local/`, which is gitignored.
- **Birthdates are used only to order the lineup youngest first** (the team bag numbers the smallest kids lowest), and are never written into the workbook.
- Notes like "shy" or "needs help" are a coach's working notes about children. Phase 1 keeps them in the browser; no phase puts them on a public URL.

## Quickstart

Requires [uv](https://docs.astral.sh/uv/).

```bash
uv sync                                        # create .venv and install
uv run hirdir build examples/example-team.json # → local/example-team.xlsx
```

For a real team, copy the example to `local/my-team.json`, fill in the roster and schedule, and run:

```bash
uv run hirdir build local/my-team.json         # → local/my-team.xlsx
```

Then open the workbook in Excel, or upload it to Google Sheets, and print the sheet for the next game (File → Print, current sheet, landscape, fit to width).

### Config

```json
{
  "team": "Little Kickers",
  "season": "Fall 2026",
  "on_field": 4,
  "stints": 4,
  "practice_rows": 5,
  "players": [{"name": "Ada", "dob": "2021-05-04"}],
  "games": [{"date": "2026-09-20", "opponent": "Otters", "field": "1"}]
}
```

| Key | Meaning |
|---|---|
| `on_field` | Players per side; fills in the fair-share calculation, and can be changed per game in the sheet |
| `stints` | How many In/Out pairs each kid's row gets |
| `practice_rows` | Blank activity lines in each game sheet's practice section |
| `practice_title` | Heading for that section — e.g. `"WARM-UP — before kickoff"` for age groups whose session is all game |
| `players[].dob` | Optional. Orders the lineup youngest first; players without one keep their listed order, last |

## What the workbook contains

- **Roster** — the one place names and jersey numbers are typed. Two spare rows for late sign-ups, which appear on every game sheet automatically.
- **Season** — minutes per kid per game, games attended, games missed, total and per-game minutes, season ± fair, goals and flag counts. All formulas; nothing to type here.
- **Activities** — a starter library of drills, with room to add your own. It sits third, ahead of the game sheets, so it doesn't get lost behind a season of tabs.
- **One sheet per game** — a practice or warm-up plan on top (with a drop-down from the Activities tab and +/~/− ratings), and below it the grid: `Here ✓ / A`, the `In`/`Out` stopwatch-minute pairs, `Minutes played`, `± fair`, goals, ★/shy/needs-help, notes.

**During a game:** start a phone stopwatch at kickoff and pause it for the break. Write the minute when a kid goes on and when they come off. If a kid is still on at the whistle, leave the last `Out` blank and fill in *Game ended at minute*. Tick `Here` even for a kid who refuses to play, so the fair-share maths still counts them.

**The `Here` column takes three states:**

| Mark | Means |
|---|---|
| `✓` | Came. Counts toward fair share even with no minutes — a kid who refuses to go on is owed time next week. |
| `A` | Didn't come. Greys out the row, is left out of fair share, and shows as `A` in the Season tab with a `Missed` tally. |
| blank | Nothing was recorded. Treated like absent for the maths, but says so honestly. |

If you already know a kid will miss the next game, type `A` in that game's sheet **before printing** — the row prints greyed out, so you won't call a name nobody answers to.

`± fair` compares a kid's minutes against an even split — game length × players per side ÷ kids present. Red means they are owed time next week.

## Development

```bash
uv run pytest                  # or: ws test hirdir
uv run ruff check src tests    # or: ws lint hirdir
uv run ruff format src tests   # or: ws format hirdir
```

Tests are split into `tests/unit` (workbook structure, fast) and `tests/integration`, which evaluates the generated formulas with [`formulas`](https://pypi.org/project/formulas/) — a wrong cell reference fails there rather than at the field.

`hirdir build` also caches computed values into the file (`--no-bake` skips it). openpyxl writes formulas without cached values, so previewers that don't recalculate — Quick Look, phone file previews — would otherwise show blanks. Excel and Google Sheets recalculate on open either way.
