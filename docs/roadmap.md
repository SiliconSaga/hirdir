# Why this exists, and where it's going

Hirðir answers three questions a volunteer coach cannot answer from memory during a game:

- **Who has had the least field time?** Playing time should be roughly even, and at 4v4 with ten five-year-olds it drifts fast.
- **Who needs more of my attention?** The confident kids are fine with less; the shy or struggling ones are why you are there.
- **What should we do in practice?** Especially for the youngest groups, where the session is half practice.

The long game is the fourth question, which only pays off with a season of data behind it: **how do you split the league into teams that are actually even?** Not one team with five stars and another with five kids who won't leave their parents.

## Phases

| Phase | What | Where team data lives |
|---|---|---|
| **0 — done** | A printable `.xlsx` per team: one sheet per game recording field time as stopwatch minutes in and out, plus goals, ★/shy/needs-help flags and a practice plan | A gitignored directory on the coach's machine |
| **1 — live** | A static coach page: tap a kid to sub them in or out, with live field-time clocks; browser storage only | The coach's browser |
| **1.5** | Dictated notes — the phone's own mic into the note box, then a model turning "Ada finally went in, loved it" into structured marks | Same |
| **2** | A backend on the cluster with coach login (Keycloak) and player history across seasons, plus a Google Sheets bridge so a roster doesn't have to be hand-made | Postgres, behind login |
| **3** | Roster balancing for the league, using past-season history | Same |

The constraint that shapes all of it: **dozens of volunteer coaches, none of whom should need to know what a JSON file or a Google Sheets API is.** Anything that gates coaching on setup is a feature that won't get used.

## Open work

- [Issue #2](https://github.com/SiliconSaga/hirdir/issues/2) — a wrap-up screen to replace the browser prompt when a game is reconstructed after a forgotten whistle, collecting what never got tapped while it's still fresh.
- [Issue #3](https://github.com/SiliconSaga/hirdir/issues/3) — shipping in three flavors: the standalone page as it is now, a hosted instance with storage, and a fully connected one that syncs rosters and history. The same app at three levels of ambition, so a coach can start with the first and never notice the others exist.
- A build step for the field app, so the service-worker cache name derives from a content hash rather than a human remembering to change a number. See [`development.md`](development.md#deploy).

## Design documents

- [`plans/2026-09-19-hirdir-phases-design.md`](plans/2026-09-19-hirdir-phases-design.md) — the phases above, in full, with the open questions.
- [`plans/2026-09-20-hirdir-phase1-field-app-design.md`](plans/2026-09-20-hirdir-phase1-field-app-design.md) — the field app's design: the event log, the fair-share model, the forgotten whistle, and the three flavors.
- [`plans/2026-09-20-hirdir-phase1-field-app-plan.md`](plans/2026-09-20-hirdir-phase1-field-app-plan.md) — the task-by-task implementation plan it was built from.
