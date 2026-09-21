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

const now = () => clock.elapsed();
const current = () => fold(log.events, team.roster, now());

function persist() {
  storage.save({ ...team, events: log.events, clock: clock.state() });
}

function draw() {
  render(
    buildView(current(), {
      clockSeconds: now(),
      onFieldTarget: team.onFieldTarget,
      pendingSub,
      logSize: log.size(),
    }),
  );
}

function append(type, fields = {}) {
  log.append(type, fields, now());
  persist();
  draw();
}

async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock?.request("screen");
  } catch {
    /* unsupported or denied: the screen may sleep, the game continues */
  }
}

function releaseWakeLock() {
  try {
    wakeLock?.release();
  } catch {
    /* already gone */
  }
  wakeLock = null;
}

function kidAction(kidId, action) {
  if (action === "on") {
    if (!log.size()) append("game_start");
    if (!clock.isRunning()) {
      clock.start();
      requestWakeLock();
    }
    // Nobody comes off while there is still room on the field — filling up at
    // kickoff is not a swap.
    const state = current();
    const onNow = [...state.kids.values()].filter((kid) => kid.onField).length;
    const proposedOut = onNow >= team.onFieldTarget ? (proposeSubOff(state)?.id ?? null) : null;
    pendingSub = { inKid: kidId, proposedOut };
    draw();
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
  const json = toJson({ v: 1, ...team, events: log.events });
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
    if (clock.isRunning()) {
      clock.pause();
      releaseWakeLock();
    } else {
      clock.start();
      requestWakeLock();
      if (!log.size()) log.append("game_start", {}, 0);
    }
    persist();
    draw();
  },
  confirmSub() {
    if (!pendingSub) return;
    if (pendingSub.proposedOut) append("sub_out", { kid: pendingSub.proposedOut });
    append("sub_in", { kid: pendingSub.inKid });
    pendingSub = null;
    draw();
  },
  cancelSub() {
    pendingSub = null;
    draw();
  },
  undo() {
    log.undo();
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
    append("game_end");
    clock.pause();
    releaseWakeLock();
    persist();
    draw();
  },
  exportGame,
  async importConfig(file) {
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
