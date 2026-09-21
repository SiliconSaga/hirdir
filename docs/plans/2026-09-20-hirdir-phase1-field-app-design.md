# Hirðir Phase 1 — the field app

**Status:** Design approved 2026-09-20; not yet implemented.
**Supersedes nothing.** Extends [2026-09-19-hirdir-phases-design.md](2026-09-19-hirdir-phases-design.md), which stays the phase map of record.

## What the paper taught us

Phase 0's workbook was used for real on 2026-09-20, across a Little Kickers game and a 1st/2nd grade game. The theory held: recording in/out minutes is the right ledger, and ± fair is the number worth knowing. The paper did not hold.

What actually went wrong, in the coach's words and worth quoting because every design decision below answers one of them:

- **The printouts got wet** on a cart over the course of a morning, and juggling them during play was its own job.
- **Substitutions are sudden.** Kids swap themselves while the coach is talking to a parent. By the time he looked up, the sheet and the field disagreed.
- **"Not even sure who is on the field"** — jersey numbers are hard to read at distance on moving five-year-olds, and the coach's attention is on the game, not the roster.
- **"Who is meant to go on next"** required doing arithmetic on a wet page mid-game.

The app cannot see the field. It can only keep the ledger. So its job is to make the ledger cheap to update, instantly readable at a glance, and painless to correct when it drifts from reality — because it will drift.

## Goals

1. **Answer "who's on?" in one glance** — names, large, always on screen.
2. **Answer "who's next?" without arithmetic** — the bench sorts by who is owed the most time, deficit shown.
3. **One-handed subbing in two imprecise taps**, with the clocks kept automatically.
4. **Recover from drift in seconds**, because the coach will lose track and the app must not make him feel stupid about it.
5. **Survive the field**: a dropped connection, a locked screen, a reloaded tab, a dead-battery restart — none of these may lose a game's data.
6. **Keep children's data off any server** in this phase.

## Non-goals for Phase 1

- No accounts, no login, no server. Those arrive in Phase 2 with a real answer for auth. (The voice pass below introduces a small stateless endpoint before then — see the privacy note in that section.)
- No second device, no live sharing with the other coach. One operator, one phone (confirmed with the coach).
- No voice interpretation yet. Buttons first; the voice pass is specified below but built after.
- No photos of children, ever, as an aid to identification.
- No attempt to replace the Phase 0 workbook as the season record. The app exports into it.

## Shape

A single static page — no backend, no build step, no framework, no CDN — served from this repo's GitHub Pages and installable to the home screen. All state lives in the browser.

This deviates from the SiliconSaga house pattern (FastAPI + kustomize + GKE, per `skipta`, `skipan`, `ting`) in exactly two places, both forced:

- **Offline.** No sibling component has offline handling; none of them needs it. A sub-tap that round-trips to a server is a sub-tap that can hang while a child waits on the sideline. The clocks must be local and authoritative. This is new ground for the stack, not a copy of it.
- **Auth.** `skipta` and `skipan` run with no auth at all, which is fine for demo job-site data. A roster of children is not that. Phase 1 dodges the question by keeping data on the coach's phone; Phase 2 answers it with Keycloak (already running in the realm).

Everything else follows house style: vanilla JS, vendored assets, no bundler, mobile-first hand-rolled CSS, and the `<textarea>`-plus-keyboard-mic approach to dictation that `skipta` proved on job sites.

## The screen

One screen, no navigation, top to bottom:

**Game header** — team, opponent, and the game clock in large type, with a single start/pause control. Halftime is a pause. Everything below derives from this clock, so a paused clock freezes every stint.

**ON THE FIELD (4/4)** — every kid currently on, names large, each with their running stint time ("Mia · 9:12"). This is the glance that answers "who's out there?" without reading jerseys. The count in the header is the sanity check: if it says 5/4, something is wrong and the coach can see it immediately.

**BENCH — sorted by who is owed the most time**, each with their deficit against a fair share (`−6 min`). The kid at the top is the answer to "who's next?". Sorting is stable within equal deficits so rows don't shuffle under a thumb mid-tap.

**Tap a bench kid to send them on.** The app immediately proposes the on-field kid who has been on longest as the one coming off, shown as a single large confirm. Tapping any other on-field name overrides the proposal. Two taps, neither of which needs precision, and the second is pre-aimed at the statistically right answer.

**Undo** — one large, always-present button that reverses the last event. Mis-taps during chaos are guaranteed, and a coach who fears the app will punish a mistake stops using it.

**Roll call** — a grid of every kid, tap to toggle on/off, one confirm. This is the drift fix: when three kids have swapped themselves during a parent conversation, the coach re-states reality in about five seconds and the ledger accepts it without complaint.

**Per-kid actions** — goal, ★, shy, needs-help, as taps on a kid's row. These are the same signals the workbook collects, because they are what feeds roster balancing in Phase 3.

**Notes** — a plain `<textarea>` the coach can dictate into with the keyboard mic. In Phase 1 the text is stored verbatim with a timestamp and the on-field list at that moment. Nothing interprets it yet.

### Design rules for the whole screen

- Tap targets no smaller than 48px, with generous spacing: this is used one-handed, outdoors, possibly by cold fingers.
- High contrast, large type, no thin fonts. The screen will be read in sunlight at arm's length.
- No destructive action without an undo path. No confirm dialogs except the sub-off proposal, which is itself the confirm.
- The screen wake lock is held while a game is running, so the phone does not sleep mid-stint.
- **Wet screens are a physical problem, not a software one.** Capacitive touch misreads water; large targets and undo soften it, a waterproof pouch actually solves it. Say so in the README rather than pretending the UI can fix it.

## Data model

**Events, not state.** Every action appends an immutable event; the displayed state is derived by folding events in order. This is worth the small extra effort for three reasons: undo becomes "drop the last event and re-fold", the exported record is a true account of the game rather than a summary, and the Phase 1.5 voice pass can propose events that get verified and applied through exactly the same path as a button tap.

```
{ "v": 1,
  "team": "Little Kickers", "game": {"date": "2026-09-27", "opponent": "Cheetahs", "field": "4"},
  "onFieldTarget": 5,
  "roster": [{"id": "k1", "name": "Judah", "jersey": 1}, ...],
  "events": [
    {"t": 0,   "type": "game_start"},
    {"t": 0,   "type": "sub_in",  "kid": "k1"},
    {"t": 312, "type": "sub_out", "kid": "k1"},
    {"t": 420, "type": "goal",    "kid": "k4"},
    {"t": 610, "type": "flag",    "kid": "k7", "flag": "shy"},
    {"t": 700, "type": "roll_call", "on": ["k2","k3","k5","k8"]},
    {"t": 905, "type": "note",    "text": "Judah asked to come off, tired"},
    {"t": 1500,"type": "game_end"}
  ]}
```

`t` is seconds of running game clock, not wall clock, so a pause costs nothing and halftime needs no special case. `roll_call` is a single event carrying the corrected on-field set, which keeps drift-correction in the same log as everything else.

**Derived per kid:** minutes played, current stint length, ± fair. Fair share uses the Phase 0 formula so the two agree: `clock × onFieldTarget ÷ kids present`. A kid marked present who never plays still counts, which is what makes their deficit grow.

**Persistence:** the event log is written to `localStorage` after every event — the whole log, it is tiny. A reload, a crash, or a battery swap resumes mid-game. Browser storage can throw or come back empty (private windows, cleared site data), so every read is wrapped and a failure degrades to "start a new game" rather than a broken page.

## Getting data in and out

**In:** paste or open the same team config JSON that `hirdir build` already consumes, so a roster is defined once. The generator and the app share a format; neither owns it.

**Out:** at full time, export the game as JSON (the raw event log) and as a row-per-kid CSV whose columns line up with the workbook's game sheet — minutes played, goals, the three flags, notes. The workbook stays the season record until Phase 2 has a database, so the app must feed it rather than compete with it.

The export is a file the coach saves or shares from the phone. Note a sandbox constraint to verify during implementation: some embedded browsers block script-initiated downloads, in which case the fallback is a select-all-and-copy text area, which is ugly but unfailing.

## Testing

- The fold from events to state is a pure function in its own ES module, tested with `node --test`. No build step, no bundler, no framework — the same "inject the seam, fake the rest" discipline the Python side uses.
- Cases that must be covered because they are what actually happens: a kid still on at full time, a kid who never plays, `roll_call` contradicting the log, undo across a `roll_call`, a paused clock, more kids on than the target, an event log restored mid-game.
- The fair-share calculation is cross-checked against the workbook's formula on the same inputs, so paper and app cannot disagree.
- Manual smoke on an actual phone before an actual game, with a checklist in the plan document. The wet-finger problem cannot be caught in a unit test.

## Phase 1.5 — the voice pass

Specified here so the data model above is ready for it; built after the buttons prove themselves.

Dictation is the **phone keyboard's mic into a plain `<textarea>`** — the same choice `skipta` made deliberately, with no Web Speech API, no `getUserMedia`, and no audio upload. On submit, the text goes to a server endpoint that returns structured JSON describing proposed events.

The contract follows the house pattern, which is stricter than it first looks:

- **The model call is server-side**, via Vertex AI with Workload Identity and no API key, as in `skipta`, `skipan`. One deviation: a greenfield component should use the current `google-genai` SDK rather than the `google-cloud-aiplatform>=1.60,<1.160` pin, which those repos already flag as debt on a deprecated surface.
- **A fallback chain of models**, not one, tried in order on either an API error or schema-invalid output (`HIRDIR_MODEL_NAMES`, defaulting to the current Flash tier and its lite sibling).
- **Structured JSON out**, validated twice: a hand-written OpenAPI-subset schema sent as `response_schema`, and a re-validation of the response locally, because the API's guarantee is not one you should rely on alone.
- **A deterministic verifier is the real guardrail** — the lesson from `skipta`'s `UNMATCHED` and `skipan`'s `verifier.py`. Ours rejects any kid not on the roster, any `sub_out` for a kid the ledger says is not on, any `sub_in` for a kid already on, and anything that would push the on-field count past the target without a matching `sub_out`. Rejections are shown, not silently dropped.
- **Interpret, show, confirm — never auto-apply**, following `skipan`'s split of suggest from apply, and re-verifying at apply time against freshly folded state rather than trusting what the client sends back.
- **The raw dictated text is stored verbatim as a `note` event regardless of interpretation.** If the model misreads "Mia's on, Judah's off", the coach still has the sentence. This is the difference between a lossy feature and a safe one.

Offline queueing of dictated notes is possible — they are just events — but the interpretation step needs the network. The honest behaviour when offline is to store the note and say plainly that it has not been interpreted yet.

**This pass is where Phase 1's privacy promise ends, and that has to be said out loud rather than discovered later.** "Judah's off, Mia's on" contains children's first names, and interpreting it means sending that sentence — plus enough roster context for the model to resolve names to ids — to a server and on to Vertex AI. Three consequences to decide before building it, not after:

- Hirðir gains its first server, so the endpoint's exposure matters immediately. It should be stateless: text and roster context in, proposed events out, nothing stored, nothing logged beyond a request id and an outcome. No transcript, no names, in the application logs.
- Sending first names to a model API is a different promise than "everything stays on your phone". It is defensible — first names alone, no surnames, no birthdates, no contact details — but it is the coach's call to make knowingly, and the README must say what leaves the device.
- **Decided 2026-09-20:** dictation accepts **either names or jersey numbers, interchangeably** — "seven off, three on" and "Judah off, Mia on" resolve the same way, because a coach thinks in whichever comes first under pressure. The coach accepts first names reaching the model: disjointed first names, with no surnames, birthdates, or contact details, are a proportionate exposure for the benefit. Hirðir deliberately holds the **minimum identifying data** — first name, jersey number, and (locally only, never in a workbook or a request) a birthdate used solely for lineup order. TeamSnap remains the system of record for everything else; we copy the minimum across rather than mirroring a child's file.

## The forgotten whistle, and the wrap-up

Decided 2026-09-21, not yet built.

The clock persists as a wall-clock timestamp, so a game nobody ended keeps running while the page is closed — and anyone still on the field keeps accruing with it, because an open stint counts up to "now". Reopen the next morning and the game reads fourteen hours with three kids owed a lifetime. A forgotten whistle doesn't just look wrong, it corrupts that game's minutes and every ± fair derived from them.

**Soft cap, never a silent edit.** A game whose clock has run past a configurable maximum (two hours covers every MTL format, including a whole Little Kickers session with practice) is paused on open and the coach is asked what happened. The app never rewrites the log by itself; the log only ever grows by the coach's answer.

**The ask is an opportunity, not an apology.** The coach is reconstructing anyway, so the wrap-up invites the last few things that never got tapped:

- **A suggested end time**, derived rather than guessed: the last recorded event plus a short grace. "The last sub was at 38 minutes — did it end around 43?" That is a far easier question than "what minute did the game end?".
- **The bits that happened after the last tap** — a late goal, a kid who came off early, a note while it is still fresh. This is the part worth building well: the end of a game is exactly when a coach remembers that Judah scored and that someone spent the last ten minutes crying at the cone.

**Reconstructed events are marked as such.** Anything added during the wrap-up carries a flag distinguishing it from something tapped live. The ledger's value is that it records what happened; a memory recorded as an observation is still worth having, but it should not claim to be a stopwatch reading. Phase 3's roster balancing will read these; it should know which ones were remembered.

Open: whether the same wrap-up should be offered voluntarily at the final whistle, rather than only as a rescue for a forgotten one. Probably yes — the prompting is useful regardless of whether anyone forgot anything.

## Flavors — the same app at three levels of ambition

Decided 2026-09-21. This mirrors how `kubicvalheim` ships (plain Docker / plain k8s / GitOps) and what `kubicgamehosting` does across the stack: one thing, adopted at the depth a given operator wants.

**A hard constraint shapes all of it: there are dozens of MTL coaches, most of whom have never thought about Google Sheets, OAuth consent, or what a token is.** Any flavor that requires a coach to set something up before their first game is a flavor that will not be used. Setup burden belongs to whoever runs the league's instance, never to the coach with a whistle in their mouth.

| Flavor | What a coach does | What it needs | What it buys |
|---|---|---|---|
| **Standalone** (built) | Opens a URL, imports a roster, coaches | Nothing. A static page. | Field time, goals, notes, export. Data never leaves the phone. |
| **Hosted** | Logs in | A pod, Postgres from `mimir`, Keycloak | Season history, a second device, voice notes interpreted server-side, rosters handed to them rather than imported |
| **Connected** | Logs in | The above, plus credentials held *by the service* | The league's Google Sheet as roster of record, TeamSnap import, results flowing back — with no coach ever seeing a consent screen |

The point of the table is the last column of the last row: **in the connected flavor the integration credential belongs to the service, not the coach.** That is the `skipta` and `skipan` pattern — Workload Identity, no key, the pod reads the sheet as itself — and it is what lets a non-technical coach benefit from a Sheets integration without knowing one exists.

This also revisits an earlier note: a browser-only Google sign-in could technically let a static page read and write a sheet, and it is genuinely viable for *one* technically-inclined coach. It is the wrong default here, for the reason above. Recording it so the option isn't rediscovered and mistaken for a shortcut.

**What this asks of the architecture, cheaply, now:** the app should treat its storage as an interface rather than assume `localStorage`, so a remote store slots in behind the same calls; and it should decide its flavor from configuration it is given, defaulting to standalone when there is none. `storage.js` is already shaped that way (the backing is injected). Nothing else needs building until the hosted flavor is real.

## Phase 2 — backend, auth, and the Google Sheet

Sketched, not specced; a separate design round. What the coach has already settled:

- **Auth via Keycloak**, which the realm already runs, rather than `ting`'s sealed-code sessions or the skip* pair's no-auth posture. This is the phase where children's names first reach a server, so it is also the phase where that question gets a real answer rather than a deferral.
- **The roster of record is the league's existing Google Sheet.** This fits the house pattern well — `skipta` and `skipan` both treat a Sheet as the database, read server-side through Workload Identity with no key. Hirðir reads the roster; it does not write the league's sheet.
- **TeamSnap API import is wanted but low priority** — copy-paste covers it today. It becomes worth building if the league adopts this across teams and seasons, which is the same threshold that makes multi-coach support matter.
- Shape, when it happens, is the house one: FastAPI on 8000, `GET /healthz`, `ghcr.io/siliconsaga/hirdir`, kustomize `k8s/base` plus per-tier overlays, Gateway API `HTTPRoute` on `traefik-gateway` (no per-host Certificate for a `*.cmdbee.org` name), Postgres via a Mimir claim if a database is needed, env prefix `HIRDIR_`, config in a ConfigMap and only genuine secrets in a Secret.

## Open questions

1. **Does the two-tap sub survive a real game?** The proposal-to-confirm step assumes the longest-on kid is usually the right one to pull. If it is wrong more often than it is right, the second tap becomes a correction and the flow is worse than a single-tap toggle. Answered by using it, not by discussion.
2. **Is the bench sort stable enough to tap?** Re-sorting after every event could move a row under the coach's thumb. A settle delay, or freezing the order while a sub is in progress, may be needed.
3. ~~**What happens to a game that is never ended?**~~ Settled 2026-09-21 — see "The forgotten whistle, and the wrap-up" above: soft cap, ask, suggest an end time from the last event, and use the moment to collect what never got tapped.
4. **Does the phone's download work from the installed app?** Determines whether export needs the copy-to-clipboard fallback.
5. **Where does the app live, exactly?** A repo-level GitHub Pages path is simplest; a friendlier hostname is nicer to type on a phone. The page holds no roster either way, but a public URL that looks like a league tool invites questions worth pre-empting.
