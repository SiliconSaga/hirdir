// The append-only event log: the single source of truth for a game.

// A cheap content fingerprint, for "is what I exported still what is here?".
// Length alone cannot answer that: undo followed by a different action leaves
// it unchanged. Derived from the events themselves, so it survives a reload
// and can be compared against one stored beside them.
export function fingerprint(events) {
  const text = JSON.stringify(events);
  let hash = 0x811c9dc5; // FNV-1a, 32-bit
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${events.length}:${(hash >>> 0).toString(36)}`;
}

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
