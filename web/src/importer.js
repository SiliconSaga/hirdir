// Reads the same team config the workbook generator uses. Birthdates order
// the lineup and are then dropped — they must never reach app state.

export class ImportError extends Error {}

export function importTeam(config) {
  const players = config?.players;
  if (!Array.isArray(players) || players.length === 0) {
    throw new ImportError("This config needs a players list with at least one player.");
  }
  const named = players.map((player, index) => {
    if (!player?.name) throw new ImportError(`Player ${index + 1} has no name.`);
    return { name: String(player.name), dob: player.dob ?? null };
  });
  const dated = named.filter((p) => p.dob).sort((a, b) => (a.dob < b.dob ? 1 : -1));
  const undated = named.filter((p) => !p.dob);
  return {
    team: String(config.team ?? "Team"),
    onFieldTarget: Number(config.on_field ?? 4),
    roster: [...dated, ...undated].map((player, index) => ({
      id: `k${index + 1}`,
      name: player.name,
      jersey: null,
    })),
  };
}
