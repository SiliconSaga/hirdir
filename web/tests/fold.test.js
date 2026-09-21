import { test } from "node:test";
import assert from "node:assert/strict";
import { fold } from "../src/fold.js";

const roster = [
  { id: "k1", name: "Judah", jersey: 1 },
  { id: "k2", name: "Mia", jersey: 2 },
  { id: "k3", name: "Eli", jersey: 3 },
];

const ev = (t, type, fields = {}) => ({ seq: 0, t, type, ...fields });

test("a closed stint counts its seconds", () => {
  const state = fold(
    [ev(0, "game_start"), ev(0, "sub_in", { kid: "k1" }), ev(300, "sub_out", { kid: "k1" })],
    roster,
    600,
  );
  assert.equal(state.kids.get("k1").seconds, 300);
  assert.equal(state.kids.get("k1").onField, false);
});

test("an open stint counts up to now", () => {
  const state = fold([ev(0, "game_start"), ev(60, "sub_in", { kid: "k2" })], roster, 300);
  const mia = state.kids.get("k2");
  assert.equal(mia.seconds, 240);
  assert.equal(mia.onField, true);
  assert.equal(mia.stintStart, 60);
});

test("a kid still on at full time stops accruing at game_end", () => {
  const state = fold(
    [ev(0, "game_start"), ev(0, "sub_in", { kid: "k1" }), ev(1500, "game_end")],
    roster,
    9999,
  );
  assert.equal(state.kids.get("k1").seconds, 1500);
  assert.equal(state.ended, true);
});

test("multiple stints add up", () => {
  const state = fold(
    [
      ev(0, "game_start"),
      ev(0, "sub_in", { kid: "k1" }),
      ev(100, "sub_out", { kid: "k1" }),
      ev(200, "sub_in", { kid: "k1" }),
      ev(250, "sub_out", { kid: "k1" }),
    ],
    roster,
    999,
  );
  assert.equal(state.kids.get("k1").seconds, 150);
});

test("a kid who never plays has zero seconds and is still present", () => {
  const state = fold([ev(0, "game_start")], roster, 600);
  assert.equal(state.kids.get("k3").seconds, 0);
  assert.equal(state.kids.get("k3").present, true);
});

test("a sub_in for a kid already on is ignored rather than double-counted", () => {
  const state = fold(
    [ev(0, "game_start"), ev(0, "sub_in", { kid: "k1" }), ev(60, "sub_in", { kid: "k1" })],
    roster,
    120,
  );
  assert.equal(state.kids.get("k1").seconds, 120);
});

test("a sub_out for a kid who is not on is ignored", () => {
  const state = fold([ev(0, "game_start"), ev(60, "sub_out", { kid: "k1" })], roster, 120);
  assert.equal(state.kids.get("k1").seconds, 0);
});
