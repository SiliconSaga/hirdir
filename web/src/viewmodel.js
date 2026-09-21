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
