// The demo roster, for showing the app to someone without a team file on
// hand. Invented names. Kept identical to examples/example-team.json by
// tests/example-team.test.js — that file stays the one source of truth.

export const EXAMPLE_TEAM = {
  team: "Example Little Kickers",
  season: "Fall 2026",
  on_field: 4,
  stints: 4,
  practice_rows: 5,
  players: [
    { name: "Ada", dob: "2021-05-04" },
    { name: "Bjorn", dob: "2022-01-19" },
    { name: "Cleo", dob: "2021-11-02" },
    { name: "Dev", dob: "2022-06-28" },
    { name: "Esme", dob: "2021-08-15" },
    { name: "Finn", dob: "2021-03-30" },
    { name: "Gita", dob: "2022-03-11" },
    { name: "Hugo", dob: "2021-09-22" },
  ],
  games: [
    { date: "2026-09-20", opponent: "Otters", field: "1" },
    { date: "2026-09-27", opponent: "Badgers", field: "4" },
    { date: "2026-10-04", opponent: "Herons", field: "5" },
  ],
};
