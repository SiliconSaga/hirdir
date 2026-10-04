// Bootstrap: the only module that touches window — clock, storage, wake lock, tick.

import { createClock, overran, suggestedEnd } from "./clock.js";
import { createLog, fingerprint } from "./log.js";
import { fold } from "./fold.js";
import { proposeSubOff } from "./selectors.js";
import { buildView } from "./viewmodel.js";
import { browserBacking, createStorage } from "./storage.js";
import { importTeam } from "./importer.js";
import { addKid, editKid } from "./roster.js";
import { EXAMPLE_TEAM } from "./example-team.js";
import { toCsv, toJson } from "./exporter.js";
import {
  bind,
  confirmImport,
  confirmNewGame,
  confirmReset,
  openRollCall,
  render,
  renderRoster,
  setImportStatus,
  setRosterStatus,
  showText,
} from "./ui.js";

const backing = browserBacking(window);
const storage = createStorage(backing);
if (backing.volatile) document.getElementById("storage-warning").hidden = false;
const saved = storage.load();
let team = saved ?? { team: "", onFieldTarget: 4, roster: [], events: [], clock: null };
let log = createLog(team.events ?? []);
let clock = createClock(() => Date.now(), team.clock);
let pendingSub = null;
let wakeLock = null;
let wakeGeneration = 0;
let loadCount = 0;
// What the log looked like at the last export, so "new game" can tell the
// difference between discarding a saved record and discarding the only copy.
// A fingerprint, not a count: undo then a different action leaves the count
// alone, and that game is no longer the one on disk.
let exportedAt = team.exportedAt ?? "";

// With no team loaded the page is empty and the one thing you need — the
// importer — is behind a collapsed summary at the bottom. Open it once, at
// startup only, so collapsing it again sticks.
if (!team.roster.length) document.getElementById("setup").open = true;

const now = () => clock.elapsed();
const current = () => fold(log.events, team.roster, now());

function persist() {
  team = { ...team, clock: clock.state(), exportedAt };
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
// Only kicks off a game that has not started. A paused clock stays paused:
// subbing someone during halftime should not quietly restart it.
function startGame() {
  if (current().started) return;
  log.append("game_start", {}, now());
  clock.start();
  requestWakeLock();
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
  } else if (action === "away") {
    // The button says "away"; the event stays "absent", which is what the
    // fold, the export and the workbook's Here column already speak.
    append("absent", { kid: kidId });
  } else {
    append("flag", { kid: kidId, flag: action });
  }
}

// One route for every way a team arrives — a picked file, the example — so
// the confirmation, the error handling and the feedback cannot drift apart.
function loadTeam(readConfig) {
  const apply = async () => {
    // Reading a file is async, so two loads can be in flight at once and
    // finish out of order. Only the most recent pick may win — otherwise a
    // slow file read lands after a later choice and replaces it.
    const token = ++loadCount;
    try {
      const config = await readConfig();
      if (token !== loadCount) return;
      const parsed = importTeam(config);
      releaseWakeLock(); // the old game is gone; its screen lock goes with it
      team = { ...parsed, events: [], clock: null };
      log = createLog([]);
      clock = createClock(() => Date.now(), null);
      pendingSub = null;
      exportedAt = "";
      persist();
      draw();
      renderRoster(team.roster);
      // Say so: a picker that closes with nothing visibly different is
      // indistinguishable from a failure.
      setImportStatus(`Loaded ${parsed.team} — ${parsed.roster.length} players.`);
    } catch (error) {
      if (token !== loadCount) return; // a stale failure must not shout over a live load
      setImportStatus(`Could not read that file: ${error.message}`);
    }
  };
  // Loading a team wipes the game, and these controls sit one tap from the
  // export button — so a game in progress asks first, in-page.
  if (log.size()) confirmImport(apply);
  else apply();
}

// Everything an export is made from: the events, the names and numbers the
// CSV prints, and the minutes the clock has run. A game exported mid-half is
// out of date a second later, and that is the honest answer.
function exportState() {
  return fingerprint({ events: log.events, roster: team.roster, elapsed: Math.round(now()) });
}

function endGame() {
  const state = current();
  if (!state.started || state.ended) return;
  // Remember whether the clock was running, so undoing this does not restart a
  // clock that was paused at halftime when the game ended.
  append("game_end", { wasRunning: clock.isRunning() });
  clock.pause();
  releaseWakeLock();
  pendingSub = null;
  persist();
  draw();
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
    // Only a download that actually started counts as a record on disk; the
    // copy-out fallback below leaves it with the coach, not with the browser.
    exportedAt = exportState();
    persist();
  } catch {
    showText(csv); // select-all and copy: ugly, but it never fails
  }
}

bind({
  kidAction,
  // Roster edits change the team, not the game: they are not events, so undo
  // does not reach them. Ids never move, so a rename mid-game is safe and a
  // kid added mid-game simply arrives owed time, like a late arrival.
  addKid(name, jersey) {
    try {
      team = { ...team, roster: addKid(team.roster, { name, jersey }) };
      persist();
      renderRoster(team.roster);
      draw();
      setRosterStatus(`Added ${team.roster.at(-1).name}.`);
      return true;
    } catch (error) {
      setRosterStatus(error.message);
      return false;
    }
  },
  editKid(id, change, value) {
    try {
      team = { ...team, roster: editKid(team.roster, id, { [change]: value }) };
      persist();
      draw(); // the game lists carry the name and number too
      setRosterStatus("Saved.");
      return team.roster.find((kid) => kid.id === id)?.[change] ?? "";
    } catch (error) {
      setRosterStatus(error.message);
      renderRoster(team.roster); // refused: put back what is actually stored
      return undefined;
    }
  },
  newGame() {
    if (!log.size()) {
      setRosterStatus("Nothing to clear — this game has nothing in it yet.");
      return;
    }
    const clear = () => {
      releaseWakeLock();
      log = createLog([]);
      clock = createClock(() => Date.now(), null);
      pendingSub = null;
      exportedAt = "";
      team = { ...team, events: [], clock: null };
      persist();
      draw();
      setRosterStatus("New game. The team is as you left it.");
    };
    // The dialog can sit open while the clock runs on, so what it said when it
    // opened may no longer hold when the coach taps. Only one direction is
    // dangerous: a game that read as saved and no longer is must ask again,
    // with the right warning, rather than go ahead on the strength of the old
    // one. (The other way round is harmless — the warning was the cautious
    // answer either way.)
    const ask = (saved) =>
      confirmNewGame(
        saved
          ? "The team stays as it is. This game's minutes, goals and notes are cleared — you have exported exactly what is here."
          : "This game has changed since it was last exported, if it ever was, and clearing it is the one thing undo cannot take back.",
        () => {
          if (saved && exportState() !== exportedAt) ask(false);
          else clear();
        },
      );
    ask(exportState() === exportedAt);
  },
  toggleClock() {
    if (current().ended) return;
    if (clock.isRunning()) {
      clock.pause();
      releaseWakeLock();
      persist();
      draw();
    } else if (current().started) {
      clock.resume(); // an explicit tap on the clock is the way to unpause
      requestWakeLock();
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
  // One button: the final whistle while a game runs, and the way back to an
  // empty app when none does. They are never both useful at once, and a coach
  // mid-match should not be one tap from clearing the roster.
  endOrReset() {
    const state = current();
    if (state.started && !state.ended) {
      endGame();
      return;
    }
    if (!team.roster.length && !log.size()) {
      setRosterStatus("Nothing to reset — no team is loaded.");
      return;
    }
    confirmReset(
      log.size() && exportState() !== exportedAt
        ? "The team, the numbers and this game all go, and this game has changed since it was last exported, if it ever was. None of it can be got back."
        : "The team, the numbers and anything recorded all go. The app goes back to empty, ready for another team.",
      () => {
        releaseWakeLock();
        storage.clear();
        team = { team: "", onFieldTarget: 4, roster: [], events: [], clock: null };
        log = createLog([]);
        clock = createClock(() => Date.now(), null);
        pendingSub = null;
        exportedAt = "";
        persist();
        draw();
        renderRoster(team.roster);
        setRosterStatus("");
        setImportStatus("Reset. Load a team file, or add players above.");
      },
    );
  },
  exportGame,
  importConfig: (file) => loadTeam(async () => JSON.parse(await file.text())),
  loadExample: () => loadTeam(async () => EXAMPLE_TEAM),
});

// A game left running — the coach forgot the whistle and the page sat there,
// or was closed, since the clock is anchored to wall time. Stop it before the
// first render, and ask; the log is only ever changed by the answer.
function checkForForgottenGame() {
  const state = current();
  if (!state.started || state.ended || !overran(now())) return;
  clock.pause();
  releaseWakeLock();
  persist();

  const suggestion = suggestedEnd(log.events, now());
  const asMinutes = Math.round(suggestion / 60);
  const ran = Math.round(now() / 3600);
  const answer = window.prompt(
    `This game has been running for about ${ran} hours — it looks like it never got ended.\n\n` +
      `The last thing recorded was at ${Math.round((log.events.at(-1)?.t ?? 0) / 60)} minutes. ` +
      `End it at minute ${asMinutes}?\n\n` +
      `Enter a minute, or cancel to leave the game open.`,
    String(asMinutes),
  );
  if (answer === null) return; // left open on purpose
  const minute = Number(answer);
  const seconds = Math.round(minute * 60);
  const lastRecorded = log.events.at(-1)?.t ?? 0;
  // A game cannot end before the last thing that happened in it, nor after
  // the clock actually ran. Out of range means the answer was a typo.
  if (!Number.isFinite(seconds) || seconds < lastRecorded || seconds > now()) return;
  log.append("game_end", { wasRunning: false, reconstructed: true }, seconds);
  // Wind the clock back to the chosen end, so the screen and the log agree.
  clock = createClock(() => Date.now(), { accumulatedMs: seconds * 1000, runningSince: null });
  persist();
}

checkForForgottenGame();

// The browser drops a wake lock whenever the page is hidden, so coming back
// to a running game has to ask for it again.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (clock.isRunning() && !current().ended) requestWakeLock();
});

if (clock.isRunning() && !current().ended) requestWakeLock();

setInterval(draw, 1000);
draw();
renderRoster(team.roster); // once: the editor is repainted only when it changes

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {
    /* offline support is a bonus, never a blocker */
  });
}
