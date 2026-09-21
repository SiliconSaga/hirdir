// Reads the same team config the workbook generator uses. Birthdates order
// the lineup and are then dropped — they must never reach app state.

export class ImportError extends Error {}

const DEFAULT_ON_FIELD = 4;

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
    return { name: String(player.name), dob: player.dob ?? null };
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
