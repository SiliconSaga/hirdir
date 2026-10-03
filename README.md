# Hirðir

![A Norse settlement at sunrise: small children playing sports guided by coaches](docs/images/hirdir-banner.jpg)

*Old Norse **hirðir**, "herdsman" — which is a large part of what coaching a Little Kickers team involves!*

A coaching tool started for [Mountain Top League](https://soccer.mountaintopleague.com/) youth soccer. It keeps the ledger during a game — who has played how long, who is owed time next, who needs your attention — so you don't have to hold it in your head while ten five-year-olds play 4v4.

## **[Open the app →](https://siliconsaga.github.io/hirdir/)**

## For coaches

1. **Open the link on your phone.** It's a web page, so there's nothing to install from a store and no account to make.
2. **Add it to your home screen** — *Share → Add to Home Screen* on iPhone, *⋮ → Add to Home screen* on Android. It then opens like an app and works with no signal at the field.
3. **Try it:** open *Setup and export* and tap **Load example team**. The names are invented; tap around and nothing is at stake.
4. **Tap the `?`** in the top corner. That's the whole guide to using it during a game, and it's always there when you forget something mid-match.
5. **For your own team**, load a team file from *Setup and export*. Ask Rasmus for one, or see [`docs/workbook.md`](docs/workbook.md#config) for the format — it's a small text file with the roster in it.
6. **At full time:** *End game*, then **Export game**. That's the record; without it the game only lives in your phone's browser storage.

Everything stays on your phone. There is no account, and nothing about the kids is sent anywhere — the only thing the app fetches is itself.

**Prefer paper?** `hirdir build` generates a printable spreadsheet, one sheet per game, that records similarly with a stopwatch and a pencil, with some other options like suggested routines. See [`docs/workbook.md`](docs/workbook.md).

## More

| | |
|---|---|
| [`docs/field-app.md`](docs/field-app.md) | The app in detail — what it records, how the fair-share maths works, offline behaviour, what's still rough |
| [`docs/workbook.md`](docs/workbook.md) | The printable workbook: generating one, the config format, and how to fill it in during a game |
| [`docs/development.md`](docs/development.md) | Running it as a developer: setup, tests, deploy, and the traps |
| [`docs/roadmap.md`](docs/roadmap.md) | Why this exists, the phases, and what's next |

**Team data never enters this repo.** Rosters name children; the only one committed here is [`examples/example-team.json`](examples/example-team.json), whose names are invented. Real configs and workbooks live in `local/`, which is gitignored. Details in [`docs/development.md`](docs/development.md#team-data-never-enters-this-repo).
