# The field app

Live at **<https://siliconsaga.github.io/hirdir/>**. `web/` is a single static page — no backend, no framework, no build step — that keeps the ledger during a game so the paper doesn't have to. It publishes to GitHub Pages on every push to `main`, and installs to a phone's home screen.

The guide behind the `?` button in the app is the canonical how-to for using it during a game. This document covers what sits underneath it.

## What it records

An append-only event log: kickoff, each sub in and out, goals, ★/shy/needs-help flags, absences, roll calls, notes, and the final whistle. Each event carries the clock time it happened at. Everything on screen — minutes played, current stint, who is owed time — is derived from that log by replaying it, which is why **Undo** can simply drop the last action (a substitution included — it goes back as one) and have every number follow.

The clock is anchored to wall time, so the game keeps running while the screen is off or the app is closed.

## The team, and the next game

Both live in *Setup and export*, away from the game lists.

**The roster panel** lists the team in lineup order, each row a jersey number and a name, with an *Add* row at the bottom. A coach with no config file builds the team here; one with a file can still fix a spelling or set a number the bag turned out to use. Edits save when the field loses focus, and ids never move — renaming a child mid-game leaves their minutes exactly where they were.

It deliberately does not edit the live game rows. Those are buttons, they re-sort by who is owed time, and the one-second repaint would eat a half-typed name.

**New game** clears the log and the clock and keeps the roster, which is how next Saturday starts. It asks first, and when nothing has been exported since the last recorded action it says so — clearing an unexported game is the one thing undo cannot take back.

Jersey numbers are optional throughout. They show in the number slot on every row, ride along in the CSV's `Jersey` column, and can be carried in a config as `players[].jersey`.

## Where the data lives

In your browser's local storage, on that one device. No account, no sync, no server. Consequences worth knowing:

- Clearing site data for the page clears the game in progress.
- A private/incognito window may refuse to store at all — the app says so in a banner and keeps working, but a reload loses the game.
- Loading a different team file clears the current game. The app asks first if one is in progress.
- **Export is the only durable record.** *Export game* writes two files: a CSV whose columns match the workbook's game sheet, and the raw event log as JSON. The JSON is the complete document — team, roster, clock and every event — but the app cannot currently load it back, since the importer reads a config's `players` list rather than app state's `roster` ([issue #8](https://github.com/SiliconSaga/hirdir/issues/8)).

Exports are named `<team>-<date>`, which is enough to tell games apart at one game a day. For a double-header, export after each game and rename.

## The fair-share numbers

One kid's fair share of a game, at any moment:

```
fair = seconds the clock has run × players per side ÷ kids present
```

Their standing is `played − fair`: negative means owed time, positive means they've had more than an even share. It's zero-sum across the team — every minute one kid is on the field is a minute the others aren't — so sending the most-owed kid on is always the move that evens things out fastest.

Two things follow that surprise people:

- **The figure moves continuously, even when nothing happens.** At 5-a-side with 9 kids present, a kid on the bench falls behind by about 33 seconds per minute of clock. So a kid who just came off level will show as owed a minute shortly after, with nobody having touched anything.
- **A kid who refuses to play still counts.** Marking them *away* takes them out of the divisor; leaving them in keeps the time they're owed on the books for next week. The cost is that it lowers everyone else's share too, so in a game carried by two or three willing kids those kids read as overplayed. [Issue #6](https://github.com/SiliconSaga/hirdir/issues/6) is about recording a declined shift so both can be true at once.

The bench is sorted by who is owed the most, and shows an "owed N" figure only once a kid is a full minute behind — below that the number churned every few seconds and read as a bug.

## Offline, and deploys

A service worker caches the app shell, so a dead signal at the field changes nothing. It serves from cache and refreshes in the background, which means **a new version lands on the next open, not the current one**. After a deploy, open and close the app once at home rather than discovering a half-updated page at the field.

## Known rough edges

- **The forgotten whistle.** Because the clock follows wall time, a game left running accrues hours. Past two hours the app stops the clock on open and asks what minute to end it at, as a plain browser prompt — functional, ugly, and [issue #2](https://github.com/SiliconSaga/hirdir/issues/2) replaces it with a proper wrap-up screen that also collects what never got tapped.
- **Wet screens** are a physical problem, not a software one: capacitive touch misreads water. Big targets and undo soften it; a cheap waterproof pouch actually solves it.
- **One device, one game.** Two coaches tracking the same match on two phones produce two unrelated logs. Shared state waits on a backend — see [`roadmap.md`](roadmap.md).
- **Field time has only been tested in anger once.** Most of the app's behaviour is inferred from one phone session plus a test suite, not from a season of games.

## Running it locally

```bash
python3 -m http.server 8000 --directory web   # then open http://localhost:8000
```

Opening `web/index.html` straight from disk does **not** work: browsers block ES modules over `file://` as a cross-origin request, so the page renders but no script runs. The service worker is skipped outside http(s) regardless. More in [`development.md`](development.md).
