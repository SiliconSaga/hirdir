# Agent guidance — hirdir

Read [`README.md`](README.md) for what this is and [`docs/plans/2026-09-19-hirdir-phases-design.md`](docs/plans/2026-09-19-hirdir-phases-design.md) for where it's going.

## The one rule that matters

**Team data names children and never enters this repo.** Real rosters and generated workbooks live in `local/` (gitignored). The only committed roster is `examples/example-team.json`, and its names are invented.

- Never commit anything from `local/`, never paste roster contents into a commit message, issue, CR, or test fixture.
- **Birthdates order the lineup and are then dropped** — they must not reach the workbook. `tests/unit/test_workbook.py::test_roster_holds_no_birthdates_or_ages` enforces this; don't weaken it.
- Coach notes (shy, needs help) are observations about children. Treat any feature that would expose them — a public URL, a shared link, an export to a third-party service — as needing the human's explicit say-so.

## Working here

```bash
ws test hirdir      # uv run pytest
ws lint hirdir      # uv run ruff check src tests
ws format hirdir    # uv run ruff format src tests
ws run hirdir       # builds the example workbook into local/
```

Directly: `uv run pytest`, `uv run hirdir build examples/example-team.json`.

- `src/hirdir/sheets/` has one module per tab. `layout.py` owns the column map and row positions — the Season tab reads game sheets cell by cell, so both sides must agree, and that agreement lives there rather than in two places.
- Prefer formulas over values computed in Python: the coach edits the sheet after the game and the totals must follow.
- Anything post-2007 in a formula (`XLOOKUP`, `TEXTJOIN`, spilling arrays) won't evaluate in the `formulas` package the tests use. Stick to `SUM`/`COUNT`/`COUNTIF`/`IF`/`MAX`/`ROUND`.
- After changing a sheet builder, run the integration tests: they evaluate the workbook for real and catch wrong references that unit tests won't.
