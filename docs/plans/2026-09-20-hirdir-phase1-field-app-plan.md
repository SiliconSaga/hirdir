# Hirðir Phase 1 — field app implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, installable web app that keeps a youth-soccer game's field-time ledger on the coach's phone: who is on, who is owed time, two taps to sub, one tap to undo.

**Architecture:** One static page, no backend. Every action appends an immutable event to a log; all displayed state is a pure fold over that log. Pure modules (log, fold, selectors, export) are unit-tested with `node --test`; a thin DOM layer renders a view model and wires taps. Persistence is `localStorage` after every event.

**Tech Stack:** Vanilla ES modules, no framework, no bundler, no CDN. Node ≥ 20 for tests (`node --test`, built in). Python side (`hirdir build`) is untouched. GitHub Pages for hosting.

**Spec:** [2026-09-20-hirdir-phase1-field-app-design.md](2026-09-20-hirdir-phase1-field-app-design.md) — read it before Task 1. The phase map is [2026-09-19-hirdir-phases-design.md](2026-09-19-hirdir-phases-design.md).

## Global Constraints

- **No build step, no bundler, no framework, no CDN.** Vendored assets only; the page must open from `file://` and from GitHub Pages identically.
- **No network calls anywhere in Phase 1.** No analytics, no fonts, no API. The voice endpoint is Phase 1.5 and out of scope here.
- **Event log schema version is `1`** and every persisted document carries `"v": 1`.
- **Clock time `t` is integer seconds of running game clock**, never wall clock. A pause must not advance `t`.
- **Fair share formula must match the workbook exactly:** `clockSeconds × onFieldTarget ÷ presentCount`. A kid marked present who never plays still counts in the divisor.
- **The app holds first name and jersey number only.** Birthdates may appear in an imported config (they order the lineup) but must never be rendered, exported, or persisted by the app.
- **Tap targets ≥ 48 px**, high contrast, no thin fonts.
- **Commits use the workspace wrapper**, never raw git: write a bodyfile under `.commits/` and run `ws commit hirdir .commits/<name>.md` from the workspace root. Push with `ws push hirdir main`.
- **Tests run with `ws test hirdir`**, which after Task 1 runs both the Python and the JavaScript suites.
- Every file starts with a one-line docstring/comment stating its contract, matching the Python side's house style.

---

## File structure

```
components/hirdir/
  scripts/test.sh            NEW  runs pytest + node --test + node --check
  web/
    package.json             NEW  {"type": "module"} only — no dependencies, ever
    index.html               NEW  the single page: markup only, no logic
    app.css                  NEW  hand-rolled mobile-first styles
    manifest.webmanifest     NEW  home-screen install
    sw.js                    NEW  cache-first app shell
    src/
      log.js                 NEW  append/undo over an event array; stamps seq + t
      clock.js               NEW  game clock: elapsed seconds across pause/resume
      fold.js                NEW  events -> GameState (pure)
      selectors.js           NEW  fair share, bench order, sub-off proposal (pure)
      viewmodel.js           NEW  GameState -> render model (pure, no DOM)
      storage.js             NEW  load/save a document, failure-tolerant
      importer.js            NEW  team config JSON -> roster + settings
      exporter.js            NEW  event log -> JSON blob and workbook-shaped CSV
      ui.js                  NEW  render a view model into the DOM, wire taps
      main.js                NEW  bootstrap: storage + clock + ui + wake lock
    tests/
      log.test.js            NEW
      clock.test.js          NEW
      fold.test.js           NEW
      selectors.test.js      NEW
      viewmodel.test.js      NEW
      storage.test.js        NEW
      importer.test.js       NEW
      exporter.test.js       NEW
  .github/workflows/pages.yml NEW  publish web/ to GitHub Pages
  README.md                  MODIFY  add a "Phase 1 field app" section
realms/realm-siliconsaga/adapters/hirdir.yaml  MODIFY  test -> bash scripts/test.sh
```

Responsibility boundaries worth defending during review: `fold.js` never reads the clock or the DOM; `selectors.js` never mutates; `ui.js` contains no arithmetic; `main.js` is the only module that knows about `window`.

---

### Task 1: Test harness and the event log

**Files:**
- Create: `components/hirdir/web/package.json`, `components/hirdir/web/src/log.js`, `components/hirdir/web/tests/log.test.js`, `components/hirdir/scripts/test.sh`
- Modify: `realms/realm-siliconsaga/adapters/hirdir.yaml`

**Interfaces:**
- Consumes: nothing.
- Produces: `createLog(events = [])` returning `{ events, append(type, fields, t), undo(), size() }`. `append` returns the appended event `{seq, t, type, ...fields}` where `seq` is 1-based and `t` is the integer seconds passed in. `undo()` removes and returns the last event, or `null` when empty.

- [ ] **Step 1: Write the failing test**

Create `web/tests/log.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createLog } from "../src/log.js";

test("append stamps a 1-based sequence and keeps the given clock time", () => {
  const log = createLog();
  const first = log.append("game_start", {}, 0);
  const second = log.append("sub_in", { kid: "k1" }, 12);
  assert.deepEqual(first, { seq: 1, t: 0, type: "game_start" });
  assert.deepEqual(second, { seq: 2, t: 12, type: "sub_in", kid: "k1" });
  assert.equal(log.size(), 2);
});

test("undo removes the last event and returns it", () => {
  const log = createLog();
  log.append("game_start", {}, 0);
  const removed = log.append("goal", { kid: "k2" }, 30);
  assert.deepEqual(log.undo(), removed);
  assert.equal(log.size(), 1);
});

test("undo on an empty log returns null rather than throwing", () => {
  assert.equal(createLog().undo(), null);
});

test("a log restored from events continues its sequence", () => {
  const log = createLog([{ seq: 1, t: 0, type: "game_start" }]);
  assert.equal(log.append("sub_in", { kid: "k1" }, 5).seq, 2);
});

test("t is rounded to whole seconds", () => {
  assert.equal(createLog().append("sub_in", { kid: "k1" }, 12.7).t, 13);
});
```

- [ ] **Step 2: Create the package marker so Node treats these as ES modules**

Create `web/package.json`:

```json
{
  "name": "hirdir-web",
  "private": true,
  "type": "module",
  "description": "Field app — no dependencies, no build step. Tests: node --test web/tests"
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd components/hirdir && node --test web/tests/log.test.js`
Expected: FAIL — `Cannot find module .../src/log.js`

- [ ] **Step 4: Write the minimal implementation**

Create `web/src/log.js`:

```js
// The append-only event log: the single source of truth for a game.

export function createLog(events = []) {
  const log = events.slice();
  return {
    events: log,
    append(type, fields = {}, t = 0) {
      const event = { seq: log.length + 1, t: Math.round(t), type, ...fields };
      log.push(event);
      return event;
    },
    undo() {
      return log.length ? log.pop() : null;
    },
    size() {
      return log.length;
    },
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd components/hirdir && node --test web/tests/log.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 6: Wire both suites into one test command**

Create `components/hirdir/scripts/test.sh`:

```bash
#!/usr/bin/env bash
# Runs both suites: Python (workbook generator) and JavaScript (field app).
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== python =="
uv run --frozen pytest

echo "== javascript syntax =="
find web/src web/tests -name '*.js' -print0 | xargs -0 -n1 node --check

echo "== javascript =="
node --test web/tests
```

Then `chmod +x components/hirdir/scripts/test.sh`.

Modify `realms/realm-siliconsaga/adapters/hirdir.yaml`, replacing the `test:` line:

```yaml
  test: "bash scripts/test.sh"
```

- [ ] **Step 7: Verify the combined runner passes**

Run: `ws test hirdir`
Expected: the Python suite's 39 tests pass, every JS file passes `node --check`, and the 5 log tests pass.

- [ ] **Step 8: Commit**

Write `.commits/hirdir-web-log.md`:

```markdown
---
message: "feat(web): event log and a test runner for both suites"
add:
  - web/
  - scripts/test.sh
---

Phase 1 starts from the log: every tap appends an event and state is a fold over it, so undo is a re-fold rather than a reversal.

No dependencies and no build step — package.json exists only to mark the directory as ES modules.
```

Run: `ws commit hirdir .commits/hirdir-web-log.md`

Then commit the adapter separately, since it lives in the realm repo. Write `.commits/realm-hirdir-test.md`:

```markdown
---
message: "chore(realm): hirdir runs both suites through scripts/test.sh"
add:
  - adapters/hirdir.yaml
---
```

Run: `ws commit realm-siliconsaga .commits/realm-hirdir-test.md`

---

### Task 2: The game clock

**Files:**
- Create: `components/hirdir/web/src/clock.js`, `components/hirdir/web/tests/clock.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `createClock(now)` where `now` is a function returning epoch milliseconds. Methods: `start()`, `pause()`, `resume()`, `elapsed()` → integer seconds of *running* time, `isRunning()` → boolean, `state()` → `{startedAtWall, accumulatedMs, runningSince}` for persistence, and `createClock(now, state)` to restore.

- [ ] **Step 1: Write the failing test**

Create `web/tests/clock.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClock } from "../src/clock.js";

function fakeNow(start = 0) {
  let value = start;
  const now = () => value;
  now.advance = (seconds) => { value += seconds * 1000; };
  return now;
}

test("elapsed counts only running time", () => {
  const now = fakeNow();
  const clock = createClock(now);
  clock.start();
  now.advance(60);
  assert.equal(clock.elapsed(), 60);
});

test("a pause freezes the clock and a resume continues it", () => {
  const now = fakeNow();
  const clock = createClock(now);
  clock.start();
  now.advance(300);
  clock.pause();
  now.advance(600);            // halftime: 10 minutes of wall time
  assert.equal(clock.elapsed(), 300);
  clock.resume();
  now.advance(120);
  assert.equal(clock.elapsed(), 420);
});

test("elapsed is zero before the game starts", () => {
  assert.equal(createClock(fakeNow()).elapsed(), 0);
});

test("a restored clock keeps its accumulated time", () => {
  const now = fakeNow(10_000);
  const first = createClock(now);
  first.start();
  now.advance(45);
  const restored = createClock(now, first.state());
  now.advance(15);
  assert.equal(restored.elapsed(), 60);
  assert.equal(restored.isRunning(), true);
});

test("pause is idempotent and resume on a fresh clock does not rewind", () => {
  const now = fakeNow();
  const clock = createClock(now);
  clock.start();
  now.advance(30);
  clock.pause();
  clock.pause();
  now.advance(30);
  assert.equal(clock.elapsed(), 30);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd components/hirdir && node --test web/tests/clock.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the minimal implementation**

Create `web/src/clock.js`:

```js
// Game clock: running seconds only, so halftime costs a kid no field time.

export function createClock(now, state = null) {
  let accumulatedMs = state?.accumulatedMs ?? 0;
  let runningSince = state?.runningSince ?? null;

  const elapsedMs = () =>
    accumulatedMs + (runningSince === null ? 0 : now() - runningSince);

  return {
    start() {
      if (runningSince === null) runningSince = now();
    },
    pause() {
      if (runningSince !== null) {
        accumulatedMs += now() - runningSince;
        runningSince = null;
      }
    },
    resume() {
      if (runningSince === null) runningSince = now();
    },
    elapsed() {
      return Math.floor(elapsedMs() / 1000);
    },
    isRunning() {
      return runningSince !== null;
    },
    state() {
      return { accumulatedMs, runningSince };
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd components/hirdir && node --test web/tests/clock.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

Write `.commits/hirdir-web-clock.md`:

```markdown
---
message: "feat(web): game clock that ignores paused time"
add:
  - web/src/clock.js
  - web/tests/clock.test.js
---

`now` is injected so the tests can move time without sleeping, and so a restored clock resumes mid-game after a reload.
```

Run: `ws commit hirdir .commits/hirdir-web-clock.md`

---

### Task 3: Fold — on-field set and minutes played

**Files:**
- Create: `components/hirdir/web/src/fold.js`, `components/hirdir/web/tests/fold.test.js`

**Interfaces:**
- Consumes: event objects shaped by `log.append` (Task 1).
- Produces: `fold(events, roster, nowT)` → `GameState`:
  ```
  { started: boolean, ended: boolean, endedAt: number|null,
    kids: Map<id, { id, name, jersey, onField, seconds, stintStart: number|null,
                    goals: number, flags: Set<string>, present: boolean }>,
    notes: [{ t, text, on: [id] }] }
  ```
  `seconds` counts closed stints plus the open stint up to `nowT`. `roster` is `[{id, name, jersey}]`.

- [ ] **Step 1: Write the failing test**

Create `web/tests/fold.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { fold } from "../src/fold.js";

const roster = [
  { id: "k1", name: "Judah", jersey: 1 },
  { id: "k2", name: "Mia", jersey: 2 },
  { id: "k3", name: "Eli", jersey: 3 },
];

const ev = (t, type, fields = {}) => ({ seq: 0, t, type, ...fields });

test("a closed stint counts its seconds", () => {
  const state = fold(
    [ev(0, "game_start"), ev(0, "sub_in", { kid: "k1" }), ev(300, "sub_out", { kid: "k1" })],
    roster,
    600,
  );
  assert.equal(state.kids.get("k1").seconds, 300);
  assert.equal(state.kids.get("k1").onField, false);
});

test("an open stint counts up to now", () => {
  const state = fold([ev(0, "game_start"), ev(60, "sub_in", { kid: "k2" })], roster, 300);
  const mia = state.kids.get("k2");
  assert.equal(mia.seconds, 240);
  assert.equal(mia.onField, true);
  assert.equal(mia.stintStart, 60);
});

test("a kid still on at full time stops accruing at game_end", () => {
  const state = fold(
    [ev(0, "game_start"), ev(0, "sub_in", { kid: "k1" }), ev(1500, "game_end")],
    roster,
    9999,
  );
  assert.equal(state.kids.get("k1").seconds, 1500);
  assert.equal(state.ended, true);
});

test("multiple stints add up", () => {
  const state = fold(
    [
      ev(0, "game_start"),
      ev(0, "sub_in", { kid: "k1" }),
      ev(100, "sub_out", { kid: "k1" }),
      ev(200, "sub_in", { kid: "k1" }),
      ev(250, "sub_out", { kid: "k1" }),
    ],
    roster,
    999,
  );
  assert.equal(state.kids.get("k1").seconds, 150);
});

test("a kid who never plays has zero seconds and is still present", () => {
  const state = fold([ev(0, "game_start")], roster, 600);
  assert.equal(state.kids.get("k3").seconds, 0);
  assert.equal(state.kids.get("k3").present, true);
});

test("a sub_in for a kid already on is ignored rather than double-counted", () => {
  const state = fold(
    [ev(0, "game_start"), ev(0, "sub_in", { kid: "k1" }), ev(60, "sub_in", { kid: "k1" })],
    roster,
    120,
  );
  assert.equal(state.kids.get("k1").seconds, 120);
});

test("a sub_out for a kid who is not on is ignored", () => {
  const state = fold([ev(0, "game_start"), ev(60, "sub_out", { kid: "k1" })], roster, 120);
  assert.equal(state.kids.get("k1").seconds, 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd components/hirdir && node --test web/tests/fold.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the minimal implementation**

Create `web/src/fold.js`:

```js
// Events in, game state out. Pure: no clock, no DOM, no storage.

function blankKid({ id, name, jersey }) {
  return {
    id, name, jersey,
    onField: false, seconds: 0, stintStart: null,
    goals: 0, flags: new Set(), present: true,
  };
}

export function fold(events, roster, nowT) {
  const kids = new Map(roster.map((k) => [k.id, blankKid(k)]));
  const state = { started: false, ended: false, endedAt: null, kids, notes: [] };

  const on = (kid, t) => {
    if (!kid || kid.onField) return;
    kid.onField = true;
    kid.stintStart = t;
  };
  const off = (kid, t) => {
    if (!kid || !kid.onField) return;
    kid.seconds += Math.max(0, t - kid.stintStart);
    kid.onField = false;
    kid.stintStart = null;
  };

  for (const event of events) {
    const kid = event.kid ? kids.get(event.kid) : null;
    switch (event.type) {
      case "game_start": state.started = true; break;
      case "game_end":
        state.ended = true;
        state.endedAt = event.t;
        for (const k of kids.values()) off(k, event.t);
        break;
      case "sub_in": on(kid, event.t); break;
      case "sub_out": off(kid, event.t); break;
      default: break;
    }
  }

  const cutoff = state.ended ? state.endedAt : nowT;
  for (const kid of kids.values()) {
    if (kid.onField) kid.seconds += Math.max(0, cutoff - kid.stintStart);
  }
  return state;
}
```

Note the open-stint handling: the loop closes stints on `game_end`, and the trailing pass adds the still-open stint up to `nowT`. A kid closed by `game_end` is no longer `onField`, so they are not counted twice.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd components/hirdir && node --test web/tests/fold.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

Write `.commits/hirdir-web-fold.md`:

```markdown
---
message: "feat(web): fold events into on-field state and minutes played"
add:
  - web/src/fold.js
  - web/tests/fold.test.js
---

Contradictory events are ignored rather than rejected: at the field the ledger has to accept whatever the coach managed to tap, and roll call is the repair tool.
```

Run: `ws commit hirdir .commits/hirdir-web-fold.md`

---

### Task 4: Fold — roll call, attendance, goals, flags, notes

**Files:**
- Modify: `components/hirdir/web/src/fold.js`, `components/hirdir/web/tests/fold.test.js`

**Interfaces:**
- Consumes: `fold` from Task 3.
- Produces: the same `fold` signature, now handling `roll_call {on: [id]}`, `absent {kid}`, `present {kid}`, `goal {kid}`, `flag {kid, flag}`, `note {text}`. A `flag` event toggles membership in `kid.flags`. `roll_call` subs out everyone not listed and subs in everyone listed. `absent` marks `present = false` and subs the kid out.

- [ ] **Step 1: Write the failing tests (append to `web/tests/fold.test.js`)**

```js
test("roll call replaces the on-field set, crediting time already played", () => {
  const state = fold(
    [
      ev(0, "game_start"),
      ev(0, "sub_in", { kid: "k1" }),
      ev(0, "sub_in", { kid: "k2" }),
      ev(120, "roll_call", { on: ["k2", "k3"] }),
    ],
    roster,
    180,
  );
  assert.equal(state.kids.get("k1").seconds, 120);   // credited, then off
  assert.equal(state.kids.get("k1").onField, false);
  assert.equal(state.kids.get("k2").seconds, 180);   // never left the field
  assert.equal(state.kids.get("k3").onField, true);
  assert.equal(state.kids.get("k3").seconds, 60);
});

test("an absent kid stops counting toward the team and comes off", () => {
  const state = fold(
    [ev(0, "game_start"), ev(0, "sub_in", { kid: "k1" }), ev(60, "absent", { kid: "k1" })],
    roster,
    300,
  );
  assert.equal(state.kids.get("k1").present, false);
  assert.equal(state.kids.get("k1").onField, false);
  assert.equal(state.kids.get("k1").seconds, 60);
});

test("present undoes absent", () => {
  const state = fold(
    [ev(0, "game_start"), ev(0, "absent", { kid: "k1" }), ev(60, "present", { kid: "k1" })],
    roster,
    120,
  );
  assert.equal(state.kids.get("k1").present, true);
});

test("goals accumulate and flags toggle", () => {
  const state = fold(
    [
      ev(0, "game_start"),
      ev(30, "goal", { kid: "k2" }),
      ev(90, "goal", { kid: "k2" }),
      ev(100, "flag", { kid: "k2", flag: "star" }),
      ev(110, "flag", { kid: "k2", flag: "shy" }),
      ev(120, "flag", { kid: "k2", flag: "star" }),
    ],
    roster,
    200,
  );
  const mia = state.kids.get("k2");
  assert.equal(mia.goals, 2);
  assert.deepEqual([...mia.flags], ["shy"]);
});

test("notes keep their timestamp and who was on at the time", () => {
  const state = fold(
    [
      ev(0, "game_start"),
      ev(0, "sub_in", { kid: "k1" }),
      ev(60, "note", { text: "Judah asked to come off" }),
    ],
    roster,
    120,
  );
  assert.deepEqual(state.notes, [{ t: 60, text: "Judah asked to come off", on: ["k1"] }]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd components/hirdir && node --test web/tests/fold.test.js`
Expected: FAIL on the five new tests (roll call ignored, `present` undefined, goals zero, notes empty).

- [ ] **Step 3: Extend the implementation**

In `web/src/fold.js`, add these cases to the `switch`, before `default`:

```js
      case "roll_call": {
        const next = new Set(event.on ?? []);
        for (const k of kids.values()) {
          if (next.has(k.id)) on(k, event.t);
          else off(k, event.t);
        }
        break;
      }
      case "absent":
        if (kid) { off(kid, event.t); kid.present = false; }
        break;
      case "present":
        if (kid) kid.present = true;
        break;
      case "goal":
        if (kid) kid.goals += 1;
        break;
      case "flag":
        if (kid) {
          if (kid.flags.has(event.flag)) kid.flags.delete(event.flag);
          else kid.flags.add(event.flag);
        }
        break;
      case "note":
        state.notes.push({
          t: event.t,
          text: event.text,
          on: [...kids.values()].filter((k) => k.onField).map((k) => k.id),
        });
        break;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd components/hirdir && node --test web/tests/fold.test.js`
Expected: PASS, 12 tests.

- [ ] **Step 5: Prove undo works across a roll call**

Undo is the app's safety net and roll call is its most destructive event, so the two must be tested together. Append to `web/tests/fold.test.js`:

```js
import { createLog } from "../src/log.js";

test("undoing a roll call restores exactly the state before it", () => {
  const log = createLog();
  log.append("game_start", {}, 0);
  log.append("sub_in", { kid: "k1" }, 0);
  const before = fold(log.events, roster, 120);
  log.append("roll_call", { on: ["k2", "k3"] }, 120);
  log.undo();
  const after = fold(log.events, roster, 120);
  assert.equal(after.kids.get("k1").onField, before.kids.get("k1").onField);
  assert.equal(after.kids.get("k1").seconds, before.kids.get("k1").seconds);
  assert.equal(after.kids.get("k2").onField, false);
});
```

Run: `cd components/hirdir && node --test web/tests/fold.test.js`
Expected: PASS, 13 tests. This passes without new implementation — that is the point of folding rather than mutating, and the test pins it so a later refactor cannot quietly break undo.

- [ ] **Step 6: Commit**

Write `.commits/hirdir-web-fold-2.md`:

```markdown
---
message: "feat(web): roll call, attendance, goals, flags and notes in the fold"
add:
  - web/src/fold.js
  - web/tests/fold.test.js
---

Roll call is one event carrying the corrected on-field set, so drift repair lands in the same log as everything else and undo covers it.
```

Run: `ws commit hirdir .commits/hirdir-web-fold-2.md`

---

### Task 5: Selectors — fair share, bench order, sub-off proposal

**Files:**
- Create: `components/hirdir/web/src/selectors.js`, `components/hirdir/web/tests/selectors.test.js`

**Interfaces:**
- Consumes: `GameState` from `fold` (Tasks 3–4).
- Produces:
  - `fairShareSeconds(state, clockSeconds, onFieldTarget)` → number (0 when nobody is present).
  - `deficit(kid, fairShare)` → `kid.seconds - fairShare`, negative when owed time.
  - `benchOrder(state, fairShare)` → array of kid objects, off-field and present, most-owed first, ties broken by fewer seconds then by roster order.
  - `onFieldOrder(state)` → array of kid objects currently on, longest current stint first.
  - `proposeSubOff(state, nowT)` → the on-field kid with the longest current stint, or `null`.

- [ ] **Step 1: Write the failing test**

Create `web/tests/selectors.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { fold } from "../src/fold.js";
import { benchOrder, deficit, fairShareSeconds, proposeSubOff } from "../src/selectors.js";

const roster = [
  { id: "k1", name: "Judah", jersey: 1 },
  { id: "k2", name: "Mia", jersey: 2 },
  { id: "k3", name: "Eli", jersey: 3 },
  { id: "k4", name: "Ada", jersey: 4 },
];
const ev = (t, type, fields = {}) => ({ seq: 0, t, type, ...fields });

test("fair share splits the game among the kids present", () => {
  const state = fold([ev(0, "game_start")], roster, 600);
  // 600 seconds x 2 on the field / 4 present = 300
  assert.equal(fairShareSeconds(state, 600, 2), 300);
});

test("an absent kid leaves the divisor", () => {
  const state = fold([ev(0, "game_start"), ev(0, "absent", { kid: "k4" })], roster, 600);
  assert.equal(fairShareSeconds(state, 600, 2), 400);
});

test("fair share is zero when nobody is present", () => {
  const state = fold(
    roster.map((k) => ev(0, "absent", { kid: k.id })),
    roster,
    600,
  );
  assert.equal(fairShareSeconds(state, 600, 2), 0);
});

test("the bench is ordered by who is owed the most time", () => {
  const state = fold(
    [
      ev(0, "game_start"),
      ev(0, "sub_in", { kid: "k1" }),
      ev(300, "sub_out", { kid: "k1" }),
      ev(0, "sub_in", { kid: "k2" }),
      ev(120, "sub_out", { kid: "k2" }),
    ],
    roster,
    600,
  );
  const fair = fairShareSeconds(state, 600, 2);
  assert.deepEqual(benchOrder(state, fair).map((k) => k.id), ["k3", "k4", "k2", "k1"]);
});

test("the bench excludes kids on the field and kids marked absent", () => {
  const state = fold(
    [ev(0, "game_start"), ev(0, "sub_in", { kid: "k1" }), ev(0, "absent", { kid: "k2" })],
    roster,
    600,
  );
  assert.deepEqual(benchOrder(state, 300).map((k) => k.id), ["k3", "k4"]);
});

test("deficit is negative for a kid who is owed time", () => {
  const state = fold([ev(0, "game_start")], roster, 600);
  assert.equal(deficit(state.kids.get("k1"), 300), -300);
});

test("the proposed sub-off is whoever has been on longest", () => {
  const state = fold(
    [
      ev(0, "game_start"),
      ev(0, "sub_in", { kid: "k1" }),
      ev(200, "sub_in", { kid: "k2" }),
    ],
    roster,
    400,
  );
  assert.equal(proposeSubOff(state, 400).id, "k1");
});

test("proposing a sub-off with nobody on the field returns null", () => {
  const state = fold([ev(0, "game_start")], roster, 100);
  assert.equal(proposeSubOff(state, 100), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd components/hirdir && node --test web/tests/selectors.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the minimal implementation**

Create `web/src/selectors.js`:

```js
// Derived questions a coach asks mid-game. Pure reads over GameState.

export function fairShareSeconds(state, clockSeconds, onFieldTarget) {
  const present = [...state.kids.values()].filter((k) => k.present).length;
  if (present === 0) return 0;
  return (clockSeconds * onFieldTarget) / present;
}

export function deficit(kid, fairShare) {
  return kid.seconds - fairShare;
}

export function benchOrder(state, fairShare) {
  return [...state.kids.values()]
    .filter((k) => k.present && !k.onField)
    .sort((a, b) => deficit(a, fairShare) - deficit(b, fairShare) || a.seconds - b.seconds);
}

export function onFieldOrder(state) {
  return [...state.kids.values()]
    .filter((k) => k.onField)
    .sort((a, b) => (a.stintStart ?? 0) - (b.stintStart ?? 0));
}

export function proposeSubOff(state, nowT) {
  return onFieldOrder(state)[0] ?? null;
}
```

`Array.prototype.sort` is stable in every engine we target, so equal keys keep roster order — which is what stops rows jumping under a thumb.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd components/hirdir && node --test web/tests/selectors.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Cross-check the fair-share formula against the workbook**

Add to `web/tests/selectors.test.js`:

```js
test("fair share matches the workbook: 30 min x 4 per side / 4 kids = 30 min", () => {
  const state = fold([ev(0, "game_start")], roster, 1800);
  assert.equal(fairShareSeconds(state, 1800, 4) / 60, 30);
});
```

Run: `cd components/hirdir && node --test web/tests/selectors.test.js`
Expected: PASS, 9 tests. (This mirrors `tests/integration/test_formulas_evaluate.py::test_minutes_and_fair_share`, where 30 minutes × 4 per side ÷ 4 kids present = 30.)

- [ ] **Step 6: Commit**

Write `.commits/hirdir-web-selectors.md`:

```markdown
---
message: "feat(web): fair share, bench order and the sub-off proposal"
add:
  - web/src/selectors.js
  - web/tests/selectors.test.js
---

Bench order is the whole point of the app: the kid owed the most time sits at the top, so "who's next?" needs no arithmetic on a wet page.

The fair-share test mirrors the workbook's integration test on the same numbers, so paper and app cannot drift apart.
```

Run: `ws commit hirdir .commits/hirdir-web-selectors.md`

---

### Task 6: Import a team config

**Files:**
- Create: `components/hirdir/web/src/importer.js`, `components/hirdir/web/tests/importer.test.js`

**Interfaces:**
- Consumes: the same JSON `hirdir build` reads (`examples/example-team.json`).
- Produces: `importTeam(json)` → `{ team, onFieldTarget, roster: [{id, name, jersey}] }`, throwing `ImportError` with a readable message on bad input. Ids are `k1..kN` in config order; `jersey` is `null` when absent. **Birthdates are read for ordering only and never copied into the result.**

- [ ] **Step 1: Write the failing test**

Create `web/tests/importer.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { ImportError, importTeam } from "../src/importer.js";

const config = {
  team: "Little Kickers",
  on_field: 5,
  players: [
    { name: "Eli", dob: "2021-06-17" },
    { name: "Judah", dob: "2023-03-06" },
    { name: "Mia" },
  ],
};

test("players arrive youngest first, matching the workbook's lineup order", () => {
  const team = importTeam(config);
  assert.deepEqual(team.roster.map((k) => k.name), ["Judah", "Eli", "Mia"]);
});

test("ids are stable and jerseys default to null", () => {
  const team = importTeam(config);
  assert.deepEqual(team.roster[0], { id: "k1", name: "Judah", jersey: null });
});

test("team name and players per side come across", () => {
  const team = importTeam(config);
  assert.equal(team.team, "Little Kickers");
  assert.equal(team.onFieldTarget, 5);
});

test("players per side defaults to 4 when the config omits it", () => {
  assert.equal(importTeam({ team: "T", players: [{ name: "A" }] }).onFieldTarget, 4);
});

test("no birthdate survives the import", () => {
  const json = JSON.stringify(importTeam(config));
  assert.equal(json.includes("2021"), false);
  assert.equal(json.includes("dob"), false);
});

test("a config with no players is rejected with a readable message", () => {
  assert.throws(() => importTeam({ team: "T", players: [] }), ImportError);
  assert.throws(() => importTeam({ team: "T" }), /needs a players list/);
});

test("a player with no name is rejected", () => {
  assert.throws(() => importTeam({ team: "T", players: [{ dob: "2021-01-01" }] }), /name/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd components/hirdir && node --test web/tests/importer.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the minimal implementation**

Create `web/src/importer.js`:

```js
// Reads the same team config the workbook generator uses. Birthdates order
// the lineup and are then dropped — they must never reach app state.

export class ImportError extends Error {}

export function importTeam(config) {
  const players = config?.players;
  if (!Array.isArray(players) || players.length === 0) {
    throw new ImportError("This config needs a players list with at least one player.");
  }
  const named = players.map((player, index) => {
    if (!player?.name) throw new ImportError(`Player ${index + 1} has no name.`);
    return { name: String(player.name), dob: player.dob ?? null };
  });
  const dated = named.filter((p) => p.dob).sort((a, b) => (a.dob < b.dob ? 1 : -1));
  const undated = named.filter((p) => !p.dob);
  return {
    team: String(config.team ?? "Team"),
    onFieldTarget: Number(config.on_field ?? 4),
    roster: [...dated, ...undated].map((player, index) => ({
      id: `k${index + 1}`,
      name: player.name,
      jersey: null,
    })),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd components/hirdir && node --test web/tests/importer.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

Write `.commits/hirdir-web-importer.md`:

```markdown
---
message: "feat(web): import the workbook's team config"
add:
  - web/src/importer.js
  - web/tests/importer.test.js
---

One roster format for both the generator and the app; neither owns it. A test asserts no birthdate survives the import, mirroring the Python side's guard.
```

Run: `ws commit hirdir .commits/hirdir-web-importer.md`

---

### Task 7: Persistence

**Files:**
- Create: `components/hirdir/web/src/storage.js`, `components/hirdir/web/tests/storage.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `createStorage(backing)` where `backing` implements `getItem/setItem/removeItem`. Methods: `save(doc)`, `load()` → doc or `null`, `clear()`. Documents are `{v: 1, team, onFieldTarget, roster, game, clock, events}`. A throwing backing, absent key, unparseable JSON, or wrong `v` all yield `null` from `load()` and a silent no-op from `save()` — the app must keep working without storage.

- [ ] **Step 1: Write the failing test**

Create `web/tests/storage.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createStorage } from "../src/storage.js";

function memoryBacking() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

const doc = { v: 1, team: "LK", onFieldTarget: 5, roster: [], game: {}, clock: {}, events: [] };

test("a saved document round-trips", () => {
  const storage = createStorage(memoryBacking());
  storage.save(doc);
  assert.deepEqual(storage.load(), doc);
});

test("an empty backing loads as null", () => {
  assert.equal(createStorage(memoryBacking()).load(), null);
});

test("unparseable data loads as null rather than throwing", () => {
  const backing = memoryBacking();
  backing.setItem("hirdir.game", "{not json");
  assert.equal(createStorage(backing).load(), null);
});

test("a document from a future schema version is ignored", () => {
  const backing = memoryBacking();
  backing.setItem("hirdir.game", JSON.stringify({ ...doc, v: 99 }));
  assert.equal(createStorage(backing).load(), null);
});

test("a backing that throws on write does not take the app down", () => {
  const storage = createStorage({
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); },
  });
  assert.doesNotThrow(() => storage.save(doc));
  assert.equal(storage.load(), null);
});

test("clear removes the document", () => {
  const storage = createStorage(memoryBacking());
  storage.save(doc);
  storage.clear();
  assert.equal(storage.load(), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd components/hirdir && node --test web/tests/storage.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the minimal implementation**

Create `web/src/storage.js`:

```js
// Browser persistence. Every access is wrapped: a private window, blocked
// site data, or a quota error must degrade to "no saved game", never a crash.

const KEY = "hirdir.game";
const VERSION = 1;

export function createStorage(backing) {
  return {
    save(doc) {
      try {
        backing.setItem(KEY, JSON.stringify({ ...doc, v: VERSION }));
      } catch {
        /* storage unavailable: the game continues in memory */
      }
    },
    load() {
      try {
        const raw = backing.getItem(KEY);
        if (!raw) return null;
        const doc = JSON.parse(raw);
        return doc?.v === VERSION ? doc : null;
      } catch {
        return null;
      }
    },
    clear() {
      try {
        backing.removeItem(KEY);
      } catch {
        /* nothing to do */
      }
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd components/hirdir && node --test web/tests/storage.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

Write `.commits/hirdir-web-storage.md`:

```markdown
---
message: "feat(web): failure-tolerant localStorage persistence"
add:
  - web/src/storage.js
  - web/tests/storage.test.js
---

The backing store is injected so the tests never touch a browser, and every access is wrapped — a coach in a private window gets a working app with no saved game, not a blank page.
```

Run: `ws commit hirdir .commits/hirdir-web-storage.md`

---

### Task 8: Export back into the workbook

**Files:**
- Create: `components/hirdir/web/src/exporter.js`, `components/hirdir/web/tests/exporter.test.js`

**Interfaces:**
- Consumes: `GameState` (Tasks 3–4), the raw event array, and `{team, game, onFieldTarget}`.
- Produces:
  - `toJson(doc)` → pretty-printed string of the whole document.
  - `toCsv(state, clockSeconds, onFieldTarget)` → a string whose header is `Player,Jersey,Here,Minutes played,+/- fair,Goals,Star,Shy,Needs help,Notes` — the workbook's game-sheet columns in order. Minutes are rounded to whole minutes. `Here` is `✓`, `A` for absent. `+/- fair` is a signed whole number of minutes.

- [ ] **Step 1: Write the failing test**

Create `web/tests/exporter.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { fold } from "../src/fold.js";
import { toCsv, toJson } from "../src/exporter.js";

const roster = [
  { id: "k1", name: "Judah", jersey: 1 },
  { id: "k2", name: "Mia", jersey: null },
];
const ev = (t, type, fields = {}) => ({ seq: 0, t, type, ...fields });

const events = [
  ev(0, "game_start"),
  ev(0, "sub_in", { kid: "k1" }),
  ev(600, "goal", { kid: "k1" }),
  ev(900, "sub_out", { kid: "k1" }),
  ev(0, "absent", { kid: "k2" }),
  ev(1800, "game_end"),
];

test("the CSV header matches the workbook's game-sheet columns", () => {
  const state = fold(events, roster, 1800);
  const [header] = toCsv(state, 1800, 4).split("\n");
  assert.equal(
    header,
    "Player,Jersey,Here,Minutes played,+/- fair,Goals,Star,Shy,Needs help,Notes",
  );
});

test("a row carries minutes, fair-share difference and goals", () => {
  const state = fold(events, roster, 1800);
  const rows = toCsv(state, 1800, 4).split("\n");
  // 30 min x 4 per side / 1 kid present = 120 min fair share; Judah played 15
  assert.equal(rows[1], "Judah,1,✓,15,-105,1,,,,");
});

test("an absent kid is marked A with no minutes", () => {
  const state = fold(events, roster, 1800);
  const rows = toCsv(state, 1800, 4).split("\n");
  assert.equal(rows[2], "Mia,,A,0,,0,,,,");
});

test("a name containing a comma is quoted", () => {
  const state = fold([ev(0, "game_start")], [{ id: "k1", name: "Ada, Jr", jersey: 7 }], 60);
  assert.match(toCsv(state, 60, 4), /"Ada, Jr"/);
});

test("the JSON export is the whole document, pretty-printed", () => {
  const doc = { v: 1, team: "LK", events };
  const parsed = JSON.parse(toJson(doc));
  assert.equal(parsed.events.length, events.length);
  assert.match(toJson(doc), /\n  /);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd components/hirdir && node --test web/tests/exporter.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the minimal implementation**

Create `web/src/exporter.js`:

```js
// Out of the app, into the season workbook: same columns, same order.

import { fairShareSeconds } from "./selectors.js";

const HEADER =
  "Player,Jersey,Here,Minutes played,+/- fair,Goals,Star,Shy,Needs help,Notes";

const cell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const minutes = (seconds) => Math.round(seconds / 60);

export function toCsv(state, clockSeconds, onFieldTarget) {
  const fair = fairShareSeconds(state, clockSeconds, onFieldTarget);
  const rows = [...state.kids.values()].map((kid) => {
    const notes = state.notes
      .filter((note) => note.on.includes(kid.id))
      .map((note) => note.text)
      .join(" · ");
    return [
      kid.name,
      kid.jersey,
      kid.present ? "✓" : "A",
      minutes(kid.seconds),
      kid.present ? minutes(kid.seconds - fair) : "",
      kid.goals,
      kid.flags.has("star") ? "★" : "",
      kid.flags.has("shy") ? "x" : "",
      kid.flags.has("help") ? "x" : "",
      notes,
    ].map(cell).join(",");
  });
  return [HEADER, ...rows].join("\n");
}

export function toJson(doc) {
  return JSON.stringify(doc, null, 2);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd components/hirdir && node --test web/tests/exporter.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run the whole suite**

Run: `ws test hirdir`
Expected: Python 39 tests plus the JS suites, all green.

- [ ] **Step 6: Commit**

Write `.commits/hirdir-web-exporter.md`:

```markdown
---
message: "feat(web): export a game as JSON and workbook-shaped CSV"
add:
  - web/src/exporter.js
  - web/tests/exporter.test.js
---

The workbook stays the season record until Phase 2 has a database, so the app feeds it rather than competing with it — the CSV header is the game sheet's columns in order.
```

Run: `ws commit hirdir .commits/hirdir-web-exporter.md`

---

### Task 9: The view model

**Files:**
- Create: `components/hirdir/web/src/viewmodel.js`, `components/hirdir/web/tests/viewmodel.test.js`

**Interfaces:**
- Consumes: `GameState`, `clockSeconds`, `onFieldTarget`, and a pending sub (`{inKid, proposedOut}` or `null`).
- Produces: `buildView(state, {clockSeconds, onFieldTarget, pendingSub})` → a plain object the DOM layer renders without arithmetic:
  ```
  { clock: "12:30", running: boolean, countLabel: "4/5", countWarning: boolean,
    onField: [{id, name, jersey, stint: "3:05"}],
    bench:   [{id, name, jersey, deficit: "-6", owed: boolean}],
    pending: null | {inName, outName, outId},
    canUndo: boolean, ended: boolean }
  ```
  Also exports `formatMmSs(seconds)`.

- [ ] **Step 1: Write the failing test**

Create `web/tests/viewmodel.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { fold } from "../src/fold.js";
import { buildView, formatMmSs } from "../src/viewmodel.js";

const roster = [
  { id: "k1", name: "Judah", jersey: 1 },
  { id: "k2", name: "Mia", jersey: 2 },
  { id: "k3", name: "Eli", jersey: 3 },
];
const ev = (t, type, fields = {}) => ({ seq: 0, t, type, ...fields });

test("formats mm:ss with a padded seconds field", () => {
  assert.equal(formatMmSs(0), "0:00");
  assert.equal(formatMmSs(65), "1:05");
  assert.equal(formatMmSs(750), "12:30");
});

test("the on-field list shows each kid's current stint", () => {
  const state = fold([ev(0, "game_start"), ev(60, "sub_in", { kid: "k1" })], roster, 240);
  const view = buildView(state, { clockSeconds: 240, onFieldTarget: 2, pendingSub: null });
  assert.deepEqual(view.onField, [{ id: "k1", name: "Judah", jersey: 1, stint: "3:00" }]);
  assert.equal(view.clock, "4:00");
});

test("the count warns when more kids are on than the target", () => {
  const state = fold(
    [ev(0, "game_start"), ev(0, "sub_in", { kid: "k1" }), ev(0, "sub_in", { kid: "k2" })],
    roster,
    60,
  );
  const view = buildView(state, { clockSeconds: 60, onFieldTarget: 1, pendingSub: null });
  assert.equal(view.countLabel, "2/1");
  assert.equal(view.countWarning, true);
});

test("bench rows show whole-minute deficits, most owed first", () => {
  const state = fold([ev(0, "game_start"), ev(0, "sub_in", { kid: "k1" })], roster, 600);
  const view = buildView(state, { clockSeconds: 600, onFieldTarget: 1, pendingSub: null });
  // fair share = 600 x 1 / 3 = 200s; k2 and k3 have played nothing
  assert.deepEqual(view.bench.map((k) => k.name), ["Mia", "Eli"]);
  assert.equal(view.bench[0].deficit, "-3");
  assert.equal(view.bench[0].owed, true);
});

test("a pending sub names both kids", () => {
  const state = fold([ev(0, "game_start"), ev(0, "sub_in", { kid: "k1" })], roster, 300);
  const view = buildView(state, {
    clockSeconds: 300,
    onFieldTarget: 1,
    pendingSub: { inKid: "k2", proposedOut: "k1" },
  });
  assert.deepEqual(view.pending, { inName: "Mia", outName: "Judah", outId: "k1" });
});

test("undo is unavailable before anything has happened", () => {
  const state = fold([], roster, 0);
  const view = buildView(state, { clockSeconds: 0, onFieldTarget: 4, pendingSub: null, logSize: 0 });
  assert.equal(view.canUndo, false);
  assert.equal(
    buildView(state, { clockSeconds: 0, onFieldTarget: 4, pendingSub: null, logSize: 1 }).canUndo,
    true,
  );
});

test("rows carry goals and flags so the row can show them", () => {
  const state = fold(
    [
      ev(0, "game_start"),
      ev(0, "sub_in", { kid: "k1" }),
      ev(30, "goal", { kid: "k1" }),
      ev(40, "flag", { kid: "k2", flag: "shy" }),
    ],
    roster,
    60,
  );
  const view = buildView(state, { clockSeconds: 60, onFieldTarget: 1, pendingSub: null, logSize: 4 });
  assert.equal(view.onField[0].goals, 1);
  assert.deepEqual(view.bench.find((k) => k.id === "k2").flags, ["shy"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd components/hirdir && node --test web/tests/viewmodel.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the minimal implementation**

Create `web/src/viewmodel.js`:

```js
// GameState in, render-ready strings out. The DOM layer does no arithmetic.

import { benchOrder, deficit, fairShareSeconds, onFieldOrder } from "./selectors.js";

export function formatMmSs(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

const signedMinutes = (seconds) => {
  const value = Math.round(seconds / 60);
  return value > 0 ? `+${value}` : String(value);
};

export function buildView(state, { clockSeconds, onFieldTarget, pendingSub, logSize = 0 }) {
  const fair = fairShareSeconds(state, clockSeconds, onFieldTarget);
  const on = onFieldOrder(state);
  const pending = pendingSub
    ? {
        inName: state.kids.get(pendingSub.inKid)?.name ?? "",
        outName: state.kids.get(pendingSub.proposedOut)?.name ?? "",
        outId: pendingSub.proposedOut ?? null,
      }
    : null;

  return {
    clock: formatMmSs(clockSeconds),
    running: state.started && !state.ended,
    countLabel: `${on.length}/${onFieldTarget}`,
    countWarning: on.length !== onFieldTarget,
    onField: on.map((kid) => ({
      id: kid.id,
      name: kid.name,
      jersey: kid.jersey,
      goals: kid.goals,
      flags: [...kid.flags],
      stint: formatMmSs(clockSeconds - (kid.stintStart ?? clockSeconds)),
    })),
    bench: benchOrder(state, fair).map((kid) => ({
      id: kid.id,
      name: kid.name,
      jersey: kid.jersey,
      goals: kid.goals,
      flags: [...kid.flags],
      deficit: signedMinutes(deficit(kid, fair)),
      owed: deficit(kid, fair) < 0,
    })),
    pending,
    canUndo: logSize > 0,
    ended: state.ended,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd components/hirdir && node --test web/tests/viewmodel.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

Write `.commits/hirdir-web-viewmodel.md`:

```markdown
---
message: "feat(web): view model so the DOM layer does no arithmetic"
add:
  - web/src/viewmodel.js
  - web/tests/viewmodel.test.js
---

Everything the screen shows is a string computed here and tested here, which is what lets the UI layer stay a thin renderer that no test needs to reach into.
```

Run: `ws commit hirdir .commits/hirdir-web-viewmodel.md`

---

### Task 10: The page — markup and styles

**Files:**
- Create: `components/hirdir/web/index.html`, `components/hirdir/web/app.css`

**Interfaces:**
- Consumes: nothing yet; Task 11 wires it.
- Produces: element ids the UI layer binds to: `#clock`, `#clock-toggle`, `#count`, `#on-field`, `#bench`, `#pending`, `#pending-confirm`, `#pending-cancel`, `#undo`, `#rollcall`, `#rollcall-grid`, `#rollcall-save`, `#note-text`, `#note-save`, `#export`, `#import-file`, `#setup`.

- [ ] **Step 1: Write the markup**

Create `web/index.html` with a `<head>` containing `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `<link rel="stylesheet" href="app.css">`, `<link rel="manifest" href="manifest.webmanifest">`, and `<script type="module" src="src/main.js"></script>`. The body, in order:

```html
<header>
  <div id="clock">0:00</div>
  <button id="clock-toggle" class="big">Start</button>
  <div id="count" aria-live="polite">0/4</div>
</header>

<section id="pending" hidden>
  <p><strong id="pending-in"></strong> goes on for <strong id="pending-out"></strong>?</p>
  <button id="pending-confirm" class="big primary">Confirm</button>
  <button id="pending-cancel" class="big">Cancel</button>
  <p class="hint">Tap a different name below to swap someone else out.</p>
</section>

<h2>On the field</h2>
<ul id="on-field" class="kid-list"></ul>

<h2>Bench — most owed first</h2>
<ul id="bench" class="kid-list"></ul>

<div class="row">
  <button id="undo" class="big">Undo</button>
  <button id="rollcall" class="big">Roll call</button>
</div>

<dialog id="rollcall-dialog">
  <p>Tap everyone who is on the field right now.</p>
  <div id="rollcall-grid"></div>
  <button id="rollcall-save" class="big primary">That's who's on</button>
</dialog>

<h2>Note</h2>
<textarea id="note-text" rows="2" placeholder="Tap here and use your keyboard's mic…"></textarea>
<button id="note-save" class="big">Save note</button>

<details id="setup">
  <summary>Setup and export</summary>
  <input type="file" id="import-file" accept="application/json">
  <button id="export" class="big">Export game</button>
</details>
```

- [ ] **Step 2: Write the styles**

Create `web/app.css`: system font stack, `--fg`/`--bg`/`--owed` custom properties, `button.big { min-height: 56px; font-size: 1.25rem; }`, kid rows at `min-height: 56px` with the name at `1.4rem` and the number/time at `1rem` in a muted colour, `#clock { font-size: 3rem; font-variant-numeric: tabular-nums; }`, `.warn { color: var(--owed); }`, and a `@media (prefers-color-scheme: dark)` block. Respect safe-area insets with `padding: env(safe-area-inset-top) …` on `body`.

- [ ] **Step 3: Verify it opens**

Run: `open components/hirdir/web/index.html` (macOS) and confirm the page renders headings, empty lists, and full-width buttons with no console errors. Nothing is interactive yet.

- [ ] **Step 4: Commit**

Write `.commits/hirdir-web-page.md`:

```markdown
---
message: "feat(web): the page — markup and field-legible styles"
add:
  - web/index.html
  - web/app.css
---

One screen, no navigation: clock, who's on, who's owed time, undo. Targets are 56px because this is used one-handed, outdoors, by a coach who is not looking at the phone.
```

Run: `ws commit hirdir .commits/hirdir-web-page.md`

---

### Task 11: Wire it up

**Files:**
- Create: `components/hirdir/web/src/ui.js`, `components/hirdir/web/src/main.js`

**Interfaces:**
- Consumes: every module so far.
- Produces: `render(view, handlers)` in `ui.js` (pure DOM writes plus delegated listeners), and a `main.js` that owns `window`: builds the clock from `Date.now`, restores the saved document, re-renders on a 1-second tick, saves after every event, and requests a screen wake lock while the clock runs.

- [ ] **Step 1: Implement `ui.js`**

Each kid row is one big tap target for the sub action, plus small explicit buttons for goal, the three flags, and (bench only) marking a kid absent. The small buttons stop propagation so they never trigger a sub by accident.

```js
// Renders a view model into the page. No arithmetic, no state.

const $ = (id) => document.getElementById(id);

function kidRow(kid, { onField }) {
  const li = document.createElement("li");
  li.className = "kid";
  li.dataset.kid = kid.id;
  li.innerHTML = `
    <button class="kid-main" data-action="${onField ? "off" : "on"}">
      <span class="jersey">${kid.jersey ?? ""}</span>
      <span class="name">${kid.name}</span>
      <span class="meta">${onField ? kid.stint : kid.deficit + " min"}</span>
    </button>
    <span class="marks">
      <button data-action="goal" aria-label="Goal for ${kid.name}">⚽${kid.goals || ""}</button>
      <button data-action="star" class="${kid.flags.includes("star") ? "set" : ""}">★</button>
      <button data-action="shy" class="${kid.flags.includes("shy") ? "set" : ""}">shy</button>
      <button data-action="help" class="${kid.flags.includes("help") ? "set" : ""}">help</button>
      ${onField ? "" : '<button data-action="absent" aria-label="Not here today">A</button>'}
    </span>`;
  if (!onField && kid.owed) li.classList.add("owed");
  return li;
}

export function render(view) {
  $("clock").textContent = view.clock;
  $("clock-toggle").textContent = view.running ? "Pause" : "Start";
  $("count").textContent = view.countLabel;
  $("count").classList.toggle("warn", view.countWarning);
  $("undo").disabled = !view.canUndo;

  for (const [id, rows, onField] of [["on-field", view.onField, true], ["bench", view.bench, false]]) {
    const list = $(id);
    list.replaceChildren(...rows.map((kid) => kidRow(kid, { onField })));
  }

  $("pending").hidden = !view.pending;
  if (view.pending) {
    $("pending-in").textContent = view.pending.inName;
    $("pending-out").textContent = view.pending.outName || "nobody";
  }
}

export function bind(handlers) {
  for (const listId of ["on-field", "bench"]) {
    $(listId).addEventListener("click", (event) => {
      const button = event.target.closest("button");
      const row = event.target.closest(".kid");
      if (!button || !row) return;
      handlers.kidAction(row.dataset.kid, button.dataset.action);
    });
  }
  $("clock-toggle").addEventListener("click", handlers.toggleClock);
  $("pending-confirm").addEventListener("click", handlers.confirmSub);
  $("pending-cancel").addEventListener("click", handlers.cancelSub);
  $("undo").addEventListener("click", handlers.undo);
  $("rollcall").addEventListener("click", handlers.openRollCall);
  $("rollcall-save").addEventListener("click", handlers.saveRollCall);
  $("note-save").addEventListener("click", () => {
    const box = $("note-text");
    if (box.value.trim()) handlers.note(box.value.trim());
    box.value = "";
  });
  $("export").addEventListener("click", handlers.exportGame);
  $("import-file").addEventListener("change", (event) => handlers.importConfig(event.target.files[0]));
}
```

- [ ] **Step 2: Implement `main.js`**

The only module that touches `window`. It holds one mutable cell and routes every tap through `kidAction`:

```js
// Bootstrap: owns the clock, storage, wake lock and the redraw tick.

import { createClock } from "./clock.js";
import { createLog } from "./log.js";
import { fold } from "./fold.js";
import { proposeSubOff } from "./selectors.js";
import { buildView } from "./viewmodel.js";
import { createStorage } from "./storage.js";
import { importTeam } from "./importer.js";
import { toCsv, toJson } from "./exporter.js";
import { bind, render } from "./ui.js";

const storage = createStorage(window.localStorage);
const saved = storage.load();
let team = saved ?? { team: "", onFieldTarget: 4, roster: [], events: [], clock: null };
const log = createLog(team.events);
const clock = createClock(() => Date.now(), team.clock);
let pendingSub = null;
let wakeLock = null;

const now = () => clock.elapsed();
const current = () => fold(log.events, team.roster, now());

function persist() {
  storage.save({ ...team, events: log.events, clock: clock.state() });
}

function draw() {
  render(buildView(current(), {
    clockSeconds: now(),
    onFieldTarget: team.onFieldTarget,
    pendingSub,
    logSize: log.size(),
  }));
}

function append(type, fields) {
  log.append(type, fields, now());
  persist();
  draw();
}

function kidAction(kidId, action) {
  const state = current();
  if (action === "on") {
    if (!log.size()) append("game_start", {});
    pendingSub = { inKid: kidId, proposedOut: proposeSubOff(state, now())?.id ?? null };
    draw();
  } else if (action === "off") {
    if (pendingSub) { pendingSub = { ...pendingSub, proposedOut: kidId }; draw(); }
    else append("sub_out", { kid: kidId });
  } else if (action === "goal") {
    append("goal", { kid: kidId });
  } else if (action === "absent") {
    append("absent", { kid: kidId });
  } else {
    append("flag", { kid: kidId, flag: action });
  }
}

bind({
  kidAction,
  toggleClock() {
    if (clock.isRunning()) { clock.pause(); releaseWakeLock(); }
    else { clock.start(); requestWakeLock(); if (!log.size()) log.append("game_start", {}, 0); }
    persist();
    draw();
  },
  confirmSub() {
    if (pendingSub?.proposedOut) append("sub_out", { kid: pendingSub.proposedOut });
    append("sub_in", { kid: pendingSub.inKid });
    pendingSub = null;
    draw();
  },
  cancelSub() { pendingSub = null; draw(); },
  undo() { log.undo(); persist(); draw(); },
  note(text) { append("note", { text }); },
  openRollCall() { /* fill #rollcall-grid from current(), then showModal() */ },
  saveRollCall() { /* append("roll_call", { on: [...checked ids] }) and close */ },
  exportGame() { offerDownload(); },
  async importConfig(file) {
    const parsed = importTeam(JSON.parse(await file.text()));
    team = { ...parsed, events: [], clock: null };
    storage.clear();
    location.reload();
  },
});

setInterval(draw, 1000);
draw();
```

`requestWakeLock` / `releaseWakeLock` wrap `navigator.wakeLock.request("screen")` in try/catch — it is unsupported on some browsers and must never break the app.

- [ ] **Step 3: Implement export with a copy fallback**

Some in-app browsers block script-initiated downloads, and an export the coach cannot retrieve is worse than none. Try the download; if it fails, show the text for copying.

```js
function offerDownload() {
  const state = current();
  const csv = toCsv(state, now(), team.onFieldTarget);
  const json = toJson({ ...team, events: log.events });
  const name = `${team.team || "game"}-${new Date().toISOString().slice(0, 10)}`;
  try {
    for (const [text, extension, type] of [[csv, "csv", "text/csv"], [json, "json", "application/json"]]) {
      const url = URL.createObjectURL(new Blob([text], { type }));
      const link = Object.assign(document.createElement("a"), { href: url, download: `${name}.${extension}` });
      link.click();
      URL.revokeObjectURL(url);
    }
  } catch {
    const box = document.getElementById("note-text");
    box.value = csv;           // select-all and copy: ugly, but it never fails
    box.select();
  }
}
```

- [ ] **Step 4: Verify by hand in a browser**

Open `web/index.html`, import `examples/example-team.json`, and walk the script: start the clock, send three kids on, confirm the count reads `3/4`, wait, sub one off, undo it, tap a goal and a flag, mark a bench kid absent, open roll call and change who is on, add a note, export. Expected: no console errors; the bench always shows the most-owed kid first; undo reverses exactly one action; tapping a goal never triggers a sub.

- [ ] **Step 5: Verify persistence**

With a game in progress, reload the page. Expected: the same on-field set, the clock continuing from where it was, and the event count unchanged.

- [ ] **Step 6: Run the whole suite**

Run: `ws test hirdir`
Expected: all Python and JS tests pass; `node --check` covers the three new files.

- [ ] **Step 7: Commit**

Write `.commits/hirdir-web-wiring.md`:

```markdown
---
message: "feat(web): wire the screen to the log, clock and storage"
add:
  - web/src/ui.js
  - web/src/main.js
---

main.js is the only module that touches window: the clock's `now`, the storage backing, the wake lock and the tick all enter there, which is what keeps every other module testable under plain node.
```

Run: `ws commit hirdir .commits/hirdir-web-wiring.md`

---

### Task 12: Install to the home screen, and publish

**Files:**
- Create: `components/hirdir/web/manifest.webmanifest`, `components/hirdir/web/sw.js`, `components/hirdir/.github/workflows/pages.yml`
- Modify: `components/hirdir/README.md`

**Interfaces:**
- Consumes: the finished app.
- Produces: an installable, offline-capable page at the repo's GitHub Pages URL.

- [ ] **Step 1: Write the manifest**

```json
{
  "name": "Hirðir — field app",
  "short_name": "Hirðir",
  "start_url": ".",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#1f5c3a"
}
```

- [ ] **Step 2: Write the service worker**

`sw.js` caches the app shell (`index.html`, `app.css`, `src/*.js`, `manifest.webmanifest`) on `install` under a versioned cache name, serves cache-first on `fetch`, and deletes older caches on `activate`. Register it from `main.js` behind `if ("serviceWorker" in navigator)`, and **only when the page is served over http(s)** so `file://` still works.

- [ ] **Step 3: Verify offline**

Serve locally (`python3 -m http.server 8000 --directory components/hirdir/web`), load `http://localhost:8000`, then stop the server and reload. Expected: the page still loads and a game in progress is intact.

- [ ] **Step 4: Add the Pages workflow**

`.github/workflows/pages.yml`: on push to `main`, `permissions: {pages: write, id-token: write, contents: read}`, steps `actions/checkout@v4` → `actions/configure-pages@v5` → `actions/upload-pages-artifact@v3` with `path: web` → `actions/deploy-pages@v4`.

- [ ] **Step 5: Document it**

Add a "Phase 1 field app" section to `README.md`: what it does, that data stays in the browser, how to install it to a home screen, the wet-screen note (a pouch beats any UI), and `node --test web/tests` for the JS suite.

- [ ] **Step 6: Commit and push**

Write `.commits/hirdir-web-publish.md`:

```markdown
---
message: "feat(web): installable offline app shell, published to Pages"
add:
  - web/manifest.webmanifest
  - web/sw.js
  - .github/workflows/pages.yml
  - README.md
---

The service worker registers only over http(s), so opening index.html straight from disk keeps working — which is how it gets tested fastest.
```

Run: `ws commit hirdir .commits/hirdir-web-publish.md`, then `ws push hirdir main`, then enable Pages for the repo (Settings → Pages → Source: GitHub Actions) if the first run reports it is disabled.

- [ ] **Step 7: Smoke test on the actual phone**

Open the Pages URL on the coach's phone, install to the home screen, import a real team config, and run a five-minute mock game: start, three subs, a roll call, a dictated note, export. Expected: no zooming required to hit a target, no accidental double-subs, the export arrives somewhere retrievable. **Record what fails here — this list is the input to the next iteration, and it matters more than any test above.**

---

## After this plan

- Field-test during a real game before adding anything. The open questions in the spec (two-tap sub, bench re-sorting under a thumb, forgotten `game_end`, download behaviour) are answered by use.
- Phase 1.5 (voice) and Phase 2 (Keycloak, the league's Google Sheet as roster of record) each get their own design round; neither is in scope here.
