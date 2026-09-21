import { test } from "node:test";
import assert from "node:assert/strict";
import { fold } from "../src/fold.js";
import { buildView, formatMmSs } from "../src/viewmodel.js";

const roster = [
  { id: "k1", name: "Judah", jersey: 1 },
  { id: "k2", name: "Mia", jersey: 2 },
  { id: "k3", name: "Eli", jersey: 3 },
];
const ev = (t, type, fields = {}) => ({ seq: 0, t, type, ...fields });

test("formats mm:ss with a padded seconds field", () => {
  assert.equal(formatMmSs(0), "0:00");
  assert.equal(formatMmSs(65), "1:05");
  assert.equal(formatMmSs(750), "12:30");
});

test("the on-field list shows each kid's current stint", () => {
  const state = fold([ev(0, "game_start"), ev(60, "sub_in", { kid: "k1" })], roster, 240);
  const view = buildView(state, { clockSeconds: 240, onFieldTarget: 2, pendingSub: null });
  assert.equal(view.onField.length, 1);
  assert.equal(view.onField[0].name, "Judah");
  assert.equal(view.onField[0].stint, "3:00");
  assert.equal(view.clock, "4:00");
});

test("the count warns when more kids are on than the target", () => {
  const state = fold(
    [ev(0, "game_start"), ev(0, "sub_in", { kid: "k1" }), ev(0, "sub_in", { kid: "k2" })],
    roster,
    60,
  );
  const view = buildView(state, { clockSeconds: 60, onFieldTarget: 1, pendingSub: null });
  assert.equal(view.countLabel, "2/1");
  assert.equal(view.countWarning, true);
});

test("bench rows show whole-minute deficits, most owed first", () => {
  const state = fold([ev(0, "game_start"), ev(0, "sub_in", { kid: "k1" })], roster, 600);
  const view = buildView(state, { clockSeconds: 600, onFieldTarget: 1, pendingSub: null });
  // fair share = 600 x 1 / 3 = 200s; k2 and k3 have played nothing
  assert.deepEqual(
    view.bench.map((k) => k.name),
    ["Mia", "Eli"],
  );
  assert.equal(view.bench[0].deficit, "-3");
  assert.equal(view.bench[0].owed, true);
});

test("a pending sub names both kids", () => {
  const state = fold([ev(0, "game_start"), ev(0, "sub_in", { kid: "k1" })], roster, 300);
  const view = buildView(state, {
    clockSeconds: 300,
    onFieldTarget: 1,
    pendingSub: { inKid: "k2", proposedOut: "k1" },
  });
  assert.deepEqual(view.pending, { inName: "Mia", outName: "Judah", outId: "k1" });
});

test("undo is unavailable before anything has happened", () => {
  const state = fold([], roster, 0);
  const view = buildView(state, { clockSeconds: 0, onFieldTarget: 4, pendingSub: null, logSize: 0 });
  assert.equal(view.canUndo, false);
  assert.equal(
    buildView(state, { clockSeconds: 0, onFieldTarget: 4, pendingSub: null, logSize: 1 }).canUndo,
    true,
  );
});

test("rows carry goals and flags so the row can show them", () => {
  const state = fold(
    [
      ev(0, "game_start"),
      ev(0, "sub_in", { kid: "k1" }),
      ev(30, "goal", { kid: "k1" }),
      ev(40, "flag", { kid: "k2", flag: "shy" }),
    ],
    roster,
    60,
  );
  const view = buildView(state, {
    clockSeconds: 60,
    onFieldTarget: 1,
    pendingSub: null,
    logSize: 4,
  });
  assert.equal(view.onField[0].goals, 1);
  assert.deepEqual(
    view.bench.find((k) => k.id === "k2").flags,
    ["shy"],
  );
});
