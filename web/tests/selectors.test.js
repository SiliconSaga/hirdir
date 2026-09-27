import { test } from "node:test";
import assert from "node:assert/strict";
import { fold } from "../src/fold.js";
import { benchOrder, deficit, fairShareSeconds, proposeSubOff } from "../src/selectors.js";

const roster = [
  { id: "k1", name: "Judah", jersey: 1 },
  { id: "k2", name: "Mia", jersey: 2 },
  { id: "k3", name: "Eli", jersey: 3 },
  { id: "k4", name: "Ada", jersey: 4 },
];
const ev = (t, type, fields = {}) => ({ seq: 0, t, type, ...fields });

test("fair share splits the game among the kids present", () => {
  const state = fold([ev(0, "game_start")], roster, 600);
  // 600 seconds x 2 on the field / 4 present = 300
  assert.equal(fairShareSeconds(state, 600, 2), 300);
});

test("an absent kid leaves the divisor", () => {
  const state = fold([ev(0, "game_start"), ev(0, "absent", { kid: "k4" })], roster, 600);
  assert.equal(fairShareSeconds(state, 600, 2), 400);
});

test("fair share is zero when nobody is present", () => {
  const state = fold(
    roster.map((k) => ev(0, "absent", { kid: k.id })),
    roster,
    600,
  );
  assert.equal(fairShareSeconds(state, 600, 2), 0);
});

test("the bench is ordered by who is owed the most time", () => {
  const state = fold(
    [
      ev(0, "game_start"),
      ev(0, "sub_in", { kid: "k1" }),
      ev(300, "sub_out", { kid: "k1" }),
      ev(0, "sub_in", { kid: "k2" }),
      ev(120, "sub_out", { kid: "k2" }),
    ],
    roster,
    600,
  );
  const fair = fairShareSeconds(state, 600, 2);
  assert.deepEqual(
    benchOrder(state, fair).map((k) => k.id),
    ["k3", "k4", "k2", "k1"],
  );
});

test("the bench excludes kids on the field and kids marked absent", () => {
  const state = fold(
    [ev(0, "game_start"), ev(0, "sub_in", { kid: "k1" }), ev(0, "absent", { kid: "k2" })],
    roster,
    600,
  );
  assert.deepEqual(
    benchOrder(state, 300).map((k) => k.id),
    ["k3", "k4"],
  );
});

test("deficit is negative for a kid who is owed time", () => {
  const state = fold([ev(0, "game_start")], roster, 600);
  assert.equal(deficit(state.kids.get("k1"), 300), -300);
});

test("the proposed sub-off is whoever has been on longest", () => {
  const state = fold(
    [ev(0, "game_start"), ev(0, "sub_in", { kid: "k1" }), ev(200, "sub_in", { kid: "k2" })],
    roster,
    400,
  );
  assert.equal(proposeSubOff(state).id, "k1");
});

test("proposing a sub-off with nobody on the field returns null", () => {
  const state = fold([ev(0, "game_start")], roster, 100);
  assert.equal(proposeSubOff(state), null);
});

test("fair share matches the workbook: 30 min x 4 per side / 4 kids = 30 min", () => {
  const state = fold([ev(0, "game_start")], roster, 1800);
  assert.equal(fairShareSeconds(state, 1800, 4) / 60, 30);
});
