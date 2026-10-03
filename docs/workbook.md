# The printable workbook

`hirdir build` generates one `.xlsx` per team: a sheet per game recording field time as stopwatch minutes in and out, plus goals, ★/shy/needs-help flags and a practice plan. It needs no app, no phone battery and no signal, and it's the right tool for a wet day.

## Generating one

Requires [uv](https://docs.astral.sh/uv/).

```bash
uv sync                                        # create .venv and install
uv run hirdir build examples/example-team.json # → local/example-team.xlsx
```

For a real team, copy the example to `local/my-team.json` (gitignored), fill in the roster and schedule, and run:

```bash
uv run hirdir build local/my-team.json         # → local/my-team.xlsx
```

Then open the workbook in Excel, or upload it to Google Sheets, and print the sheet for the next game: File → Print, current sheet, landscape, fit to width.

## Config

The same file the [field app](field-app.md) imports.

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

**Birthdates order the lineup and are then dropped.** The team bag numbers the smallest kids lowest, so youngest-first matches the jerseys. No birthdate or age is ever written into the workbook, and a test enforces it.

## What the workbook contains

- **Roster** — the one place names and jersey numbers are typed. Two spare rows for late sign-ups, which appear on every game sheet automatically.
- **Season** — minutes per kid per game, games attended, games missed, total and per-game minutes, season ± fair, goals and flag counts. All formulas; nothing to type here.
- **Activities** — a starter library of drills, with room to add your own. It sits third, ahead of the game sheets, so it doesn't get lost behind a season of tabs.
- **One sheet per game** — a practice or warm-up plan on top (with a drop-down from the Activities tab and +/~/− ratings), and below it the grid: `Here ✓ / A`, the `In`/`Out` stopwatch-minute pairs, `Minutes played`, `± fair`, goals, ★/shy/needs-help, notes.

## During a game

Start a phone stopwatch at kickoff and pause it for the break. Write the minute when a kid goes on and when they come off. If a kid is still on at the whistle, leave the last `Out` blank and fill in *Game ended at minute*. Tick `Here` even for a kid who refuses to play, so the fair-share maths still counts them.

**The `Here` column takes three states:**

| Mark | Means |
|---|---|
| `✓` | Came. Counts toward fair share even with no minutes — a kid who refuses to go on is owed time next week. |
| `A` | Didn't come. Greys out the row, is left out of fair share, and shows as `A` in the Season tab with a `Missed` tally. |
| blank | Nothing was recorded. Treated like absent for the maths, but says so honestly. |

If you already know a kid will miss the next game, type `A` in that game's sheet **before printing** — the row prints greyed out, so you won't call a name nobody answers to.

`± fair` compares a kid's minutes against an even split: game length × players per side ÷ kids present. Red means they are owed time next week. The [field app](field-app.md#the-fair-share-numbers) computes the same figure live.

## Baked values

`hirdir build` caches computed values into the file (`--no-bake` skips it). openpyxl writes formulas without cached values, so previewers that don't recalculate — Quick Look, phone file previews — would otherwise show blanks. Excel and Google Sheets recalculate on open either way.
