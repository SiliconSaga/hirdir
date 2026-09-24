// Browser persistence. Every access is wrapped: a private window, blocked
// site data, or a quota error must degrade to "no saved game", never a crash.

const KEY = "hirdir.game";
const VERSION = 1;

// Reading window.localStorage can itself throw (blocked site data, some
// private modes), so the caller gets a working no-op store instead of a
// page that dies before it renders.
export function browserBacking(win) {
  try {
    const store = win.localStorage;
    store.getItem(KEY); // touch it: the throw happens here, not at import
    return store;
  } catch {
    const memory = new Map();
    return {
      getItem: (k) => (memory.has(k) ? memory.get(k) : null),
      setItem: (k, v) => memory.set(k, v),
      removeItem: (k) => memory.delete(k),
    };
  }
}

// A document is only usable if it still looks like one: a half-written or
// hand-edited blob should start a new game, not crash mid-render.
function usable(doc) {
  return (
    doc?.v === VERSION &&
    Array.isArray(doc.roster) &&
    doc.roster.every((kid) => typeof kid?.id === "string" && typeof kid?.name === "string") &&
    Array.isArray(doc.events) &&
    doc.events.every((event) => typeof event?.type === "string" && Number.isFinite(event?.t)) &&
    Number.isInteger(doc.onFieldTarget) &&
    doc.onFieldTarget >= 1
  );
}

export function createStorage(backing) {
  return {
    save(doc) {
      try {
        backing.setItem(KEY, JSON.stringify({ ...doc, v: VERSION }));
      } catch {
        /* storage unavailable: the game continues in memory */
      }
    },
    load() {
      try {
        const raw = backing.getItem(KEY);
        if (!raw) return null;
        const doc = JSON.parse(raw);
        return usable(doc) ? doc : null;
      } catch {
        return null;
      }
    },
    clear() {
      try {
        backing.removeItem(KEY);
      } catch {
        /* nothing to do */
      }
    },
  };
}
