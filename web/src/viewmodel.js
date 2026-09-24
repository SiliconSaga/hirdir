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

export function buildView(
  state,
  { clockSeconds, onFieldTarget, pendingSub, logSize = 0, clockRunning = false },
) {
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
    // The button label follows the clock itself, not the game's lifecycle: a
    // paused clock must not still read "Pause".
    running: clockRunning,
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
      // A full minute behind, so the highlight matches the number on the row.
      owed: deficit(kid, fair) <= -60,
    })),
    // Kids marked absent leave both lists, so they need somewhere to live or
    // there is no way back from a mis-tapped "A".
    away: [...state.kids.values()]
      .filter((kid) => !kid.present)
      .map((kid) => ({ id: kid.id, name: kid.name, jersey: kid.jersey })),
    pending,
    canUndo: logSize > 0,
    ended: state.ended,
  };
}
