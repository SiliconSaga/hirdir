# Development

Two codebases in one repo, deliberately kept apart:

| | |
|---|---|
| `src/hirdir/` | The workbook generator. Python, [uv](https://docs.astral.sh/uv/), openpyxl. `src/hirdir/sheets/` has one module per tab; `layout.py` owns the column map and row positions. |
| `web/` | The field app. Vanilla ES modules, no framework, no bundler, no dependencies at runtime or in its tests. |

They share nothing but the team config format and the CSV column order — and the tests pin both, so a change on one side that breaks the other fails a build rather than a season.

## Setup

```bash
uv sync    # creates .venv and installs the generator
```

Node.js 20+ is needed only for the field app's tests (`node --test`). The app itself needs no Node at runtime.

## Everyday commands

```bash
bash scripts/test.sh           # both suites — this is what `ws test hirdir` runs
ws test hirdir web/tests/roster.test.js        # one JS file
ws test hirdir tests/unit/test_config.py       # one Python file, or a nodeid
ws test hirdir fair_share                      # anything else becomes pytest -k
uv run pytest                  # Python only
node --test web/tests          # JavaScript only
uv run ruff check src tests    # or: ws lint hirdir
uv run ruff format src tests   # or: ws format hirdir
uv run hirdir build examples/example-team.json   # or: ws run hirdir
python3 -m http.server 8000 --directory web      # serve the app at :8000
```

`web/index.html` opened from disk does **not** work: browsers block ES modules over `file://` as a cross-origin request, so the page renders and no script runs. Serve it.

## Tests

Python tests split into `tests/unit` (workbook structure, fast) and `tests/integration`, which evaluates the generated formulas with [`formulas`](https://pypi.org/project/formulas/) — a wrong cell reference fails there rather than at the field. Anything post-2007 in a formula (`XLOOKUP`, `TEXTJOIN`, spilling arrays) won't evaluate under `formulas`; stick to `SUM`/`COUNT`/`COUNTIF`/`IF`/`MAX`/`ROUND`.

The JavaScript side tests the pure modules — the event fold, the selectors, the view model, the exporter — and leaves `main.js` as the only module that touches `window`, which is where browser verification earns its keep instead.

**Two classes of bug have slipped past green suites so far**, both worth keeping in mind:

- **Every unit test starts from an empty browser.** The import path that only breaks when a game is already loaded shipped twice before a coach hit it. Test from stored state, or verify in a real browser with state in it.
- **Correct numbers can still read as bugs.** `± fair` decays continuously; a coach who looks once a minute sees it "reset". That was found by a person, not a suite.

## Deploy

`.github/workflows/pages.yml` publishes `web/` to GitHub Pages on every push to `main` that touches `web/**`. CI (`ci.yml`) runs ruff and both suites on pushes to `main` and on every pull request — a push to a topic branch with no PR open runs nothing.

**The service worker's cache name is a hand-written constant** (`CACHE` in `web/sw.js`). Bump it whenever the shell changes. Because the worker refreshes files individually, forgetting leaves an *installed* app able to serve a refreshed `main.js` importing symbols from a cached older module — and the app then fails to start at all, on a phone, possibly at a field with no signal. This isn't hypothetical; it was caught in review once with the comment telling you to bump it three lines above the constant.

`web/tests/shell.test.js` covers the half a machine can check: every module in `web/src/` appears in the worker's `SHELL` list, everything `index.html` references is cached, and the cache name still carries a version. **No test can check whether a human remembered to change the number.** The durable fix is a build step deriving the name from a content hash — owed, and waiting until the app grows another reason to build.

## Releases

Both halves of the repo version together under [SemVer](https://semver.org/), tagged `vX.Y.Z`, with [`CHANGELOG.md`](../CHANGELOG.md) in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) form — the same scheme the yggdrasil workspace uses, so the two read alike. One number covers the app and the generator: a clone at a tag is what a coach actually had that weekend.

| Bump | Meaning here |
|---|---|
| **Major** | A coach has to do something differently, or a team file or a game stored in a browser no longer loads |
| **Minor** | New capability in the app or the workbook, backwards compatible |
| **Patch** | Fixes, docs, copy — nothing new to learn |

**The changelog is curated, not generated.** An entry says what changed *for a coach*; the commit log already says what the diff did, and the provider renders it beside the release. `[Unreleased]` accumulates entries and becomes the version's section at tag time.

Cutting one:

1. `ws test hirdir` green on main — and the app opened in a real browser, since the suites deliberately do not cover `main.js`.
2. Rename `[Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD`, add a fresh empty `[Unreleased]` above it, and update the link references at the bottom.
3. Bump `version` in `pyproject.toml` and `__version__` in `src/hirdir/__init__.py`.
4. `ws commit`, then `git tag -a vX.Y.Z` and `ws push hirdir vX.Y.Z`.
5. Create the GitHub Release from the tag, pasting that changelog section as the body.

**The service worker's cache version is not this version** and does not follow it — it tracks the shell, which changes on its own cadence (see Deploy above). Conflating the two would either leave a stale app installed or invalidate every phone's cache for a docs release.

## Team data never enters this repo

Rosters name children. This is the rule that outranks the rest.

- Real team configs and generated workbooks live in `local/`, which is gitignored. Never commit anything from it; never paste roster contents into a commit message, an issue, a review comment, or a test fixture.
- The only committed roster is [`examples/example-team.json`](../examples/example-team.json), whose names are invented. `web/src/example-team.js` mirrors it so the demo works offline, and a test keeps the two in step.
- **Birthdates order the lineup and are then dropped.** They must not reach the workbook. `tests/unit/test_workbook.py::test_roster_holds_no_birthdates_or_ages` enforces this; don't weaken it.
- Coach notes (shy, needs help) are observations about children. Any feature that would expose them — a public URL, a shared link, an export to a third-party service — needs the maintainer's explicit say-so.
