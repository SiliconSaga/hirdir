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
