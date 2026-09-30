import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EXAMPLE_TEAM } from "../src/example-team.js";
import { importTeam } from "../src/importer.js";

const onDisk = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../examples/example-team.json", import.meta.url)), "utf8"),
);

test("the built-in demo roster matches examples/example-team.json", () => {
  // The JSON file is the one a coach copies to make their own; the module is
  // what the Load example button uses. They must not drift apart.
  const { _comment, ...config } = onDisk;
  assert.deepEqual(EXAMPLE_TEAM, config);
});

test("the demo roster imports cleanly", () => {
  const team = importTeam(EXAMPLE_TEAM);
  assert.equal(team.roster.length, 8);
  assert.equal(team.onFieldTarget, 4);
  assert.equal(team.roster[0].name, "Dev"); // youngest first, as ever
});
