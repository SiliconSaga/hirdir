// The append-only event log: the single source of truth for a game.

export function createLog(events = []) {
  const log = events.slice();
  let groups = 0;
  return {
    events: log,
    // `group` ties events that are one action to the coach — a swap is a
    // sub_out and a sub_in — so undo takes back the whole thing.
    append(type, fields = {}, t = 0, group = null) {
      const event = { seq: log.length + 1, t: Math.round(t), type, ...fields };
      if (group) event.g = group;
      log.push(event);
      return event;
    },
    nextGroup() {
      groups += 1;
      return `g${groups}-${Date.now()}`;
    },
    // Returns every event removed, newest first, so the caller can react to
    // what was taken back (a game_start needs the clock reset with it).
    undo() {
      if (!log.length) return [];
      const removed = [log.pop()];
      const group = removed[0].g;
      while (group && log.length && log[log.length - 1].g === group) {
        removed.push(log.pop());
      }
      return removed;
    },
    size() {
      return log.length;
    },
  };
}
