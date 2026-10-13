// Roster edits, as pure functions over the roster array.
//
// Ids are the one thing that must never move: the event log keys on them, so
// a rename has to leave k3 as k3 or a child inherits another child's minutes.

export class RosterError extends Error {}

const MAX_JERSEY = 4;

// Jerseys stay text. "00" and "07" are real numbers on a shirt and both lose
// their meaning — or their leading zero — the moment they become a Number.
export function jerseyOf(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > MAX_JERSEY) {
    throw new RosterError(`'${text}' is too long for a jersey number.`);
  }
  return text;
}

function nameOf(value) {
  const text = String(value ?? "").trim();
  if (!text) throw new RosterError("A player needs a name.");
  return text;
}

// The highest id in use, not the roster length: a roster that arrived with a
// gap would otherwise hand out an id the log may already be using.
function nextId(roster) {
  const highest = roster.reduce((max, kid) => {
    const found = /^k(\d+)$/.exec(kid.id ?? "");
    return found ? Math.max(max, Number(found[1])) : max;
  }, 0);
  return `k${highest + 1}`;
}

export function addKid(roster, { name, jersey = null } = {}) {
  return [...roster, { id: nextId(roster), name: nameOf(name), jersey: jerseyOf(jersey) }];
}

// Removing is a mark, not a splice. The event log keys on ids, so cutting a
// kid out would leave their minutes pointing at nobody — and the next kid
// added could be handed the same id and inherit them. Marked instead: they
// leave every list and the fair-share divisor, and restore brings back the
// name, the number and whatever they played.
export function removeKid(roster, id) {
  return roster.map((kid) => (kid.id === id ? { ...kid, removed: true } : kid));
}

export function restoreKid(roster, id) {
  return roster.map((kid) => {
    if (kid.id !== id) return kid;
    const { removed, ...rest } = kid;
    return rest;
  });
}

// Only the fields named in `changes` move, so setting a jersey cannot quietly
// blank a name typed in the next field along.
export function editKid(roster, id, changes = {}) {
  return roster.map((kid) =>
    kid.id === id
      ? {
          ...kid,
          name: changes.name === undefined ? kid.name : nameOf(changes.name),
          jersey: changes.jersey === undefined ? kid.jersey : jerseyOf(changes.jersey),
        }
      : kid,
  );
}
