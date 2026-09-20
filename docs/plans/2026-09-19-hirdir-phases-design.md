# Hirðir — phased design

**Status:** Phase 0 built. Phases 1–3 sketched, not specced.
**Date:** 2026-09-19

## The problem

MTL rec soccer is run by volunteer coaches, and the league's own guidance asks them to rotate players so everyone gets a fair chance to play. Nothing supports that ask. Coaching Little Kickers (4v4, no goalie, roughly ten kids, half the session is a game), three things are hard in the moment:

1. **Field time.** Keeping playing time roughly even across ten kids is guesswork once the game is moving. The game is fluid: kids quit early, refuse to go on, or wander off the field.
2. **Who needs attention.** A coach can tell within a couple of games which kids are confident and which are shy or struggling, but that knowledge evaporates between seasons — exactly when it would be most useful for balancing rosters.
3. **Practice.** Picking age-appropriate activities, and remembering which ones actually worked, is its own job. For the youngest groups half the session is practice.

## Privacy stance

Rosters name children, and notes like "shy" or "needs help" are sensitive observations about them. This constrains every phase:

- No team data in the repo. Real configs and generated workbooks live in the gitignored `local/`; the only committed roster is invented (`examples/example-team.json`).
- **Birthdates are used only to order the lineup** youngest first — the team bag issues low jersey numbers to the smallest kids, and age approximates size. They are never written into the workbook. A test asserts this.
- Phase 1 keeps everything in the coach's browser. Phase 2, the first phase with a server, needs coach login before it holds a single name.
- Nothing about a child goes on a public URL in any phase.

## Phase 0 — printable game sheets (built)

A generator (`hirdir build <config>`) produces one `.xlsx` per team from a JSON config:

- **Roster** — the only place names and jersey numbers are typed. Two spare rows for late sign-ups; they appear on every game sheet automatically because each game row references a roster row.
- **One sheet per game** — a practice plan (activity, minutes, liked/useful ratings) above a grid recording `Here ✓`, four In/Out stopwatch-minute pairs per kid, `Minutes played`, `± fair`, goals, ★/shy/needs-help and notes.
- **Season** — minutes per kid per game, games attended, totals, season ± fair, goals and flag counts. Formulas only.
- **Activities** — a starter drill library, doubling as the game sheets' drop-down.

### Decisions worth remembering

**Record what happened, don't prescribe a plan.** The first build pre-computed a fair shift rotation and shaded the planned cells. It was rejected, correctly: at this age a plan survives contact with the first kid who refuses to go on. Recording actual in/out minutes is both simpler and the thing that generalises to later phases.

**Fair share is computed, not assumed:** game length × players per side ÷ kids present. A kid who came but never played still counts, which is why `Here` is ticked even for a refusal. `± fair` is the number that carries into next week.

**Values are baked into the file.** openpyxl writes formulas with no cached value, so Quick Look and phone previews show blanks. `hirdir build` evaluates the workbook and writes the cached values back, leaving the formulas intact.

**Formulas are tested by evaluating them.** `tests/integration` fills in a realistic game and checks the resulting numbers, so a wrong reference fails in CI rather than at the field.

## Phase 1 — browser tracker

A static page (hosted alongside the MTL sites or served locally) where the coach taps a kid to sub them in or out, with a live per-kid clock and running ± fair. Goals and flags are one tap. Data stays in browser storage; export to CSV/JSON, and import a Phase 0 config.

Open questions: does a phone survive a whole game in the sun; one-handed layout; how a second coach sees the same state (probably not at all in Phase 1).

## Phase 2 — backend

A cluster-deployed service (the `ting` pattern: Postgres from `mimir`, Gateway HTTPS) with coach login, so player history survives across seasons and devices, and a second coach can share a team. Roster import could use the TeamSnap API v3 (OAuth app), though MTL assigns jersey numbers at the field rather than in TeamSnap.

The practice library becomes real here: activities with age fit and tags, suggested per team as a mix of proven and new, rated for reception and usefulness after each session, and editable by any coach.

## Phase 3 — roster balancing

Given past-season history (minutes, flags, coach notes), help the league split kids across teams so one team doesn't get five confident players and another five shy ones. This is the phase with the most social weight: it produces an input to a human decision, never the decision.
