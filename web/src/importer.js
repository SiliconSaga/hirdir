// Reads the same team config the workbook generator uses. Birthdates order
// the lineup and are then dropped — they must never reach app state.

export class ImportError extends Error {}

const DEFAULT_ON_FIELD = 4;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// The Python reader rejects anything that is not a real YYYY-MM-DD date. If
// this were laxer, the same config would order the lineup differently here,
// and the kN ids would then point at different children than the workbook's.
function birthdate(value, who) {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value);
  const parsed = ISO_DATE.test(text) ? new Date(`${text}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || !text.startsWith(parsed.toISOString().slice(0, 10))) {
    throw new ImportError(`${who}: '${text}' is not a YYYY-MM-DD date.`);
  }
  return text;
}

// Mirrors the Python parser: absent means the default, present means a whole
// number of players or an error. NaN here would silently poison fair share.
function onFieldTarget(value) {
  if (value === undefined || value === null || value === "") return DEFAULT_ON_FIELD;
  // Number() is happy to coerce true to 1 and ["3"] to 3, so check the type
  // before trusting it.
  const numeric = typeof value === "number" || typeof value === "string";
  const count = numeric ? Number(value) : NaN;
  if (!Number.isInteger(count) || count < 1) {
    throw new ImportError(`'on_field' must be a whole number of players, got ${JSON.stringify(value)}.`);
  }
  return count;
}

export function importTeam(config) {
  const players = config?.players;
  if (!Array.isArray(players) || players.length === 0) {
    throw new ImportError("This config needs a players list with at least one player.");
  }
  const named = players.map((player, index) => {
    if (!player?.name) throw new ImportError(`Player ${index + 1} has no name.`);
    return { name: String(player.name), dob: birthdate(player.dob, player.name) };
  });
  // Equal birthdates must compare 0, or sort reorders them and the lineup
  // stops matching the workbook's (Python sorts stably on the same key).
  const dated = named.filter((p) => p.dob).sort((a, b) => (a.dob < b.dob ? 1 : a.dob > b.dob ? -1 : 0));
  const undated = named.filter((p) => !p.dob);
  return {
    team: String(config.team ?? "Team"),
    onFieldTarget: onFieldTarget(config.on_field),
    roster: [...dated, ...undated].map((player, index) => ({
      id: `k${index + 1}`,
      name: player.name,
      jersey: null,
    })),
  };
}
