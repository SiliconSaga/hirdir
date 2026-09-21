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
