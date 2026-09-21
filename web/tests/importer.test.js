import { test } from "node:test";
import assert from "node:assert/strict";
import { ImportError, importTeam } from "../src/importer.js";

const config = {
  team: "Little Kickers",
  on_field: 5,
  players: [
    { name: "Eli", dob: "2021-06-17" },
    { name: "Judah", dob: "2023-03-06" },
    { name: "Mia" },
  ],
};

test("players arrive youngest first, matching the workbook's lineup order", () => {
  const team = importTeam(config);
  assert.deepEqual(
    team.roster.map((k) => k.name),
    ["Judah", "Eli", "Mia"],
  );
});

test("ids are stable and jerseys default to null", () => {
  const team = importTeam(config);
  assert.deepEqual(team.roster[0], { id: "k1", name: "Judah", jersey: null });
});

test("team name and players per side come across", () => {
  const team = importTeam(config);
  assert.equal(team.team, "Little Kickers");
  assert.equal(team.onFieldTarget, 5);
});

test("players per side defaults to 4 when the config omits it", () => {
  assert.equal(importTeam({ team: "T", players: [{ name: "A" }] }).onFieldTarget, 4);
});

test("no birthdate survives the import", () => {
  const json = JSON.stringify(importTeam(config));
  assert.equal(json.includes("2021"), false);
  assert.equal(json.includes("dob"), false);
});

test("a config with no players is rejected with a readable message", () => {
  assert.throws(() => importTeam({ team: "T", players: [] }), ImportError);
  assert.throws(() => importTeam({ team: "T" }), /needs a players list/);
});

test("a player with no name is rejected", () => {
  assert.throws(() => importTeam({ team: "T", players: [{ dob: "2021-01-01" }] }), /name/);
});

test("players sharing a birthdate keep their listed order, as the workbook does", () => {
  const twins = {
    team: "T",
    players: [
      { name: "First", dob: "2021-05-04" },
      { name: "Second", dob: "2021-05-04" },
      { name: "Third", dob: "2021-05-04" },
    ],
  };
  assert.deepEqual(
    importTeam(twins).roster.map((k) => k.name),
    ["First", "Second", "Third"],
  );
});

test("a nonsense players-per-side is rejected rather than poisoning fair share", () => {
  for (const bad of ["lots", 0, -2, 2.5, {}]) {
    assert.throws(
      () => importTeam({ team: "T", on_field: bad, players: [{ name: "A" }] }),
      /whole number of players/,
      `expected ${JSON.stringify(bad)} to be rejected`,
    );
  }
});
