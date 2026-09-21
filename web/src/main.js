// Bootstrap: the only module that touches window — clock, storage, wake lock, tick.

import { createClock } from "./clock.js";
import { createLog } from "./log.js";
import { fold } from "./fold.js";
import { proposeSubOff } from "./selectors.js";
import { buildView } from "./viewmodel.js";
import { createStorage } from "./storage.js";
import { importTeam } from "./importer.js";
import { toCsv, toJson } from "./exporter.js";
import { bind, openRollCall, render, showText } from "./ui.js";

const storage = createStorage(window.localStorage);
const saved = storage.load();
let team = saved ?? { team: "", onFieldTarget: 4, roster: [], events: [], clock: null };
let log = createLog(team.events ?? []);
let clock = createClock(() => Date.now(), team.clock);
let pendingSub = null;
let wakeLock = null;
let wakeGeneration = 0;

const now = () => clock.elapsed();
const current = () => fold(log.events, team.roster, now());

function persist() {
  team = { ...team, clock: clock.state() };
  storage.save({ ...team, events: log.events });
}

function draw() {
  render(
    buildView(current(), {
      clockSeconds: now(),
      onFieldTarget: team.onFieldTarget,
      pendingSub,
      logSize: log.size(),
      clockRunning: clock.isRunning(),
    }),
  );
}

function append(type, fields = {}, group = null) {
  log.append(type, fields, now(), group);
  persist();
  draw();
}

// The game has started when the log says so — not when the log is merely
// non-empty, since marking someone absent before kickoff is an event too.
function startGame() {
  if (!current().started) log.append("game_start", {}, now());
  if (!clock.isRunning()) {
    clock.start();
    requestWakeLock();
  }
}

// The request is async, so a pause can land while it is in flight. The
// generation counter drops a sentinel that arrives after its request was
// superseded, instead of leaving the screen awake for the rest of the day.
async function requestWakeLock() {
  const generation = ++wakeGeneration;
  try {
    const sentinel = await navigator.wakeLock?.request("screen");
    if (!sentinel) return;
    if (generation !== wakeGeneration) {
      sentinel.release().catch(() => {});
      return;
    }
    wakeLock = sentinel;
  } catch {
    /* unsupported or denied: the screen may sleep, the game continues */
  }
}

function releaseWakeLock() {
  wakeGeneration += 1;
  try {
    wakeLock?.release();
  } catch {
    /* already gone */
  }
  wakeLock = null;
}

function kidAction(kidId, action) {
  if (current().ended) return; // the game is over; the log stands as it ended

  if (action === "on") {
    startGame();
    // With room on the field a tap just puts them on: no confirm step at
    // kickoff, which is the busiest moment. Confirm is for real swaps.
    const state = current();
    const onNow = [...state.kids.values()].filter((kid) => kid.onField).length;
    if (onNow < team.onFieldTarget) {
      append("sub_in", { kid: kidId });
      return;
    }
    pendingSub = { inKid: kidId, proposedOut: proposeSubOff(state)?.id ?? null };
    draw();
  } else if (action === "present") {
    append("present", { kid: kidId });
  } else if (action === "off") {
    if (pendingSub) {
      pendingSub = { ...pendingSub, proposedOut: kidId };
      draw();
    } else {
      append("sub_out", { kid: kidId });
    }
  } else if (action === "goal") {
    append("goal", { kid: kidId });
  } else if (action === "absent") {
    append("absent", { kid: kidId });
  } else {
    append("flag", { kid: kidId, flag: action });
  }
}

function exportGame() {
  const state = current();
  const csv = toCsv(state, now(), team.onFieldTarget);
  // clock.state() rather than team.clock: the export must carry where the
  // clock actually is, not where it was when the page loaded.
  const json = toJson({ v: 1, ...team, clock: clock.state(), events: log.events });
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `${(team.team || "game").replace(/\s+/g, "-").toLowerCase()}-${stamp}`;
  try {
    for (const [text, extension, type] of [
      [csv, "csv", "text/csv"],
      [json, "json", "application/json"],
    ]) {
      const url = URL.createObjectURL(new Blob([text], { type }));
      const link = Object.assign(document.createElement("a"), {
        href: url,
        download: `${base}.${extension}`,
      });
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
  } catch {
    showText(csv); // select-all and copy: ugly, but it never fails
  }
}

bind({
  kidAction,
  toggleClock() {
    if (current().ended) return;
    if (clock.isRunning()) {
      clock.pause();
      releaseWakeLock();
      persist();
      draw();
    } else {
      startGame();
      persist();
      draw();
    }
  },
  confirmSub() {
    if (!pendingSub || current().ended) return;
    // One action by the coach, so one group: undo takes the swap back whole.
    const group = log.nextGroup();
    if (pendingSub.proposedOut) append("sub_out", { kid: pendingSub.proposedOut }, group);
    append("sub_in", { kid: pendingSub.inKid }, group);
    pendingSub = null;
    draw();
  },
  cancelSub() {
    pendingSub = null;
    draw();
  },
  // Undo means "take back that action", so the clock follows the events it
  // removes: taking back the kickoff must not leave time accruing, and taking
  // back the final whistle reopens the game.
  undo() {
    const removed = log.undo();
    const ending = removed.find((event) => event.type === "game_end");
    if (removed.some((event) => event.type === "game_start")) {
      clock = createClock(() => Date.now(), null);
      releaseWakeLock();
    } else if (ending && ending.wasRunning) {
      clock.resume();
      requestWakeLock();
    }
    pendingSub = null;
    persist();
    draw();
  },
  note(text) {
    append("note", { text });
  },
  rollCall() {
    openRollCall(
      buildView(current(), {
        clockSeconds: now(),
        onFieldTarget: team.onFieldTarget,
        pendingSub: null,
        logSize: log.size(),
      }),
      (on) => append("roll_call", { on }),
    );
  },
  endGame() {
    const state = current();
    if (!state.started || state.ended) return;
    // Remember whether the clock was running, so undoing this does not
    // restart a clock that was paused at halftime when the game ended.
    append("game_end", { wasRunning: clock.isRunning() });
    clock.pause();
    releaseWakeLock();
    pendingSub = null;
    persist();
    draw();
  },
  exportGame,
  async importConfig(file) {
    // Importing wipes the game, and the file picker is one tap from the
    // export button — so a game in progress asks first.
    if (log.size() && !window.confirm("Load a new team? This clears the game in progress.")) {
      return;
    }
    try {
      const parsed = importTeam(JSON.parse(await file.text()));
      team = { ...parsed, events: [], clock: null };
      log = createLog([]);
      clock = createClock(() => Date.now(), null);
      pendingSub = null;
      persist();
      draw();
    } catch (error) {
      showText(`Could not read that config: ${error.message}`);
    }
  },
});

setInterval(draw, 1000);
draw();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {
    /* offline support is a bonus, never a blocker */
  });
}
