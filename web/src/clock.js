// Game clock: running seconds only, so halftime costs a kid no field time.

// No youth game runs this long, so a clock past it means the coach forgot to
// end the game and the page sat open (or closed, since runningSince is wall
// time). Left running, every kid still on the field accrues with it.
export const MAX_GAME_SECONDS = 2 * 60 * 60;

// The coach answers what happened; the app only offers a sensible default —
// the last thing that actually got recorded, plus a short grace.
export const GRACE_SECONDS = 5 * 60;

export function overran(elapsedSeconds, max = MAX_GAME_SECONDS) {
  return elapsedSeconds > max;
}

export function suggestedEnd(events, elapsedSeconds, grace = GRACE_SECONDS) {
  const lastEvent = events.length ? events[events.length - 1].t : 0;
  return Math.min(lastEvent + grace, elapsedSeconds);
}

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
