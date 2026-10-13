# Changelog

All notable changes to Hirðir — the field app and the printable workbook — are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/); [docs/development.md](docs/development.md#releases) says what a bump means for a coaching tool and how a release is cut.

Both halves of the repo share one version, so a clone at `vX.Y.Z` is the app and the generator as they were used together that weekend. **1.0.0 is tagged retroactively** at the point the app had carried real teams through real game days; its section below is reconstructed from the merged-PR record rather than written at the time, and is grouped by theme instead of being exhaustive — full detail is in git history and the design docs under `docs/plans/`.

## [Unreleased]

## [1.1.0] - 2026-10-13

**Two weekends of real use, answered.** The side size is no longer fixed at whatever the team file said, the two mistakes a coach actually makes mid-game — a goal on the wrong kid, a player who should not be in the squad at all — are both fixable now, and the marks explain themselves in the app instead of only in the docs.

### Added

- **The side size is editable** — tap the count in the top corner and pick anything from 3 to 11, so one app covers 4v4 Little Kickers and 11v11 alike. It feeds the fair share, so changing it mid-game re-reckons the whole game at the new number; the dialog says so rather than pretending otherwise.
- **A player can be taken off the team** with ✕ in *The team*, and a **restore** appears where the ✕ was. It is a mark rather than a deletion: ids never move, so a restored player walks back into their own minutes. They leave both game lists, the away list, the fair-share divisor and the CSV while they are gone. No confirm dialog — reversibility is the confirmation.
- **A goal tapped onto the wrong kid can be taken back** — ⚽N− beside that player in *The team*. It records a correction rather than editing the tally, so the log stays append-only, **Undo** reaches it like anything else, and the record shows what actually happened. Asked for by another coach.
- **Jersey numbers on the roll-call grid**, number then name as the rows show them: across a field, the shirt is what you can actually read.

### Changed

- **The `?` guide now says what the marks mean**, in the words a coach would use: *shy* is hard to get onto the field and hard to keep there, wanting encouragement rather than coaching; *help* is a skill or behaviour problem — not keeping up, or shoving and the like.
- **"away" is outlined like the other marks**, so it reads as something you tap rather than as a label. It claims no pressed state, because it does something rather than toggling.
- **The count speaks its numbers** to a screen reader — "3 on, 5 a side. Tap to change." — where before it read out "three slash five", and the name now follows the numbers instead of freezing at whatever the markup said.

### Fixed

- **A goal scored while *Setup and export* is open now shows its take-back button at once**, instead of staying hidden until the panel was collapsed and reopened. The editor is still not repainted on the clock — that would eat a half-typed name — but a moved goal tally reaches it as it happens (#12).
- **Removing a player who is on the field closes their stint.** Without that, restoring them later replayed an unclosed stint: it credited the entire time they were off the team and put them back on the field besides. A restore leaves them on the bench, which is one tap to change and the safer way round.
- **Undo refuses to strip that closure** while the player is still off the team, and says why rather than silently doing nothing — it would leave exactly the unmatched record the closure exists to prevent. Once they are restored it is an ordinary action again, and Undo reopens the stint it closed.
- Taking back a goal nobody scored does nothing, rather than counting down past zero.

## [1.0.0] - 2026-10-03

**The season's working set.** A printable workbook for coaches who want paper, and a field app that has kept the ledger through real game days: minutes, fair share, goals, attendance and notes, offline, on a phone, with no account anywhere.

### Added

- **The printable workbook** (`hirdir build`) — one landscape page per game with minutes and fair share as live formulas, a roster sheet in lineup order, a season roll-up that reads every game sheet, and a suggested-activities list. Absences mark a row `A` and drop it from the share.
- **The field app**, installable to a phone's home screen and working with no signal: an append-only event log folded into everything on screen, a clock anchored to wall time so a locked screen or a closed app does not stop the game, fair share and a bench ordered by who is owed the most, roll call, goals, ★/shy/help marks, notes, and an **Undo** that takes back the last action — a substitution going back as one.
- **A coach's guide behind `?`**, which is the canonical how-to during a game, and rows that explain their own numbers.
- **The team is buildable in the app** — names and optional jersey numbers typed in during the first five minutes of a season, no file needed — and **New game** clears the game while keeping the team, which is how next Saturday starts. **Export game** writes a CSV matching the workbook's game sheet plus the raw log as JSON; it warns before clearing a game whose record is out of date.
- **End game becomes Reset everything** once no game is running, which is the way back to an empty app. One button, because the two jobs are never useful at the same moment and a coach mid-match should not be one tap from clearing the team.
- **Load example team** in one tap, with invented names, so the app can be tried with nothing at stake.
- **Jersey numbers end to end** — config, workbook roster column, app number slot and CSV — kept as text, so `00` and `07` survive.
- A README for coaches with the detail moved into `docs/`.

### Fixed

- Importing a team no longer fails silently when a game is already in progress; it asks, in-page, because an installed app can have native dialogs suppressed.
- The newest team pick wins, however slow an earlier one was to read.
- A bench figure appears only once a kid is a full minute behind — below that it churned every few seconds and read as a bug.
- A game left running past two hours stops on open and asks what minute to end it at, rather than accruing overnight.
- Export freshness follows the content of the game, not the number of events in it, so an undo followed by something else is no longer mistaken for the game already on disk.
- The wake lock survives a pause landing mid-request, and the service worker's shell cannot serve a refreshed module against cached older ones.

### Security

- **Birthdates order the lineup and are then dropped** — they never reach the workbook, and a test enforces it.
- The app's privacy claims were corrected to match what it actually does: everything stays in one browser's storage on one device, a private window may refuse to store at all and the app says so in a banner, and the only thing it fetches is itself.
- Team data never enters this repo. The only committed roster is `examples/example-team.json`, whose names are invented.

[Unreleased]: https://github.com/SiliconSaga/hirdir/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/SiliconSaga/hirdir/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/SiliconSaga/hirdir/releases/tag/v1.0.0
