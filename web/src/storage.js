// Browser persistence. Every access is wrapped: a private window, blocked
// site data, or a quota error must degrade to "no saved game", never a crash.

const KEY = "hirdir.game";
const VERSION = 1;

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
        return doc?.v === VERSION ? doc : null;
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
