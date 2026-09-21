import { test } from "node:test";
import assert from "node:assert/strict";
import { fold } from "../src/fold.js";
import { createLog } from "../src/log.js";

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

test("roll call replaces the on-field set, crediting time already played", () => {
  const state = fold(
    [
      ev(0, "game_start"),
      ev(0, "sub_in", { kid: "k1" }),
      ev(0, "sub_in", { kid: "k2" }),
      ev(120, "roll_call", { on: ["k2", "k3"] }),
    ],
    roster,
    180,
  );
  assert.equal(state.kids.get("k1").seconds, 120); // credited, then off
  assert.equal(state.kids.get("k1").onField, false);
  assert.equal(state.kids.get("k2").seconds, 180); // never left the field
  assert.equal(state.kids.get("k3").onField, true);
  assert.equal(state.kids.get("k3").seconds, 60);
});

test("an absent kid stops counting toward the team and comes off", () => {
  const state = fold(
    [ev(0, "game_start"), ev(0, "sub_in", { kid: "k1" }), ev(60, "absent", { kid: "k1" })],
    roster,
    300,
  );
  assert.equal(state.kids.get("k1").present, false);
  assert.equal(state.kids.get("k1").onField, false);
  assert.equal(state.kids.get("k1").seconds, 60);
});

test("present undoes absent", () => {
  const state = fold(
    [ev(0, "game_start"), ev(0, "absent", { kid: "k1" }), ev(60, "present", { kid: "k1" })],
    roster,
    120,
  );
  assert.equal(state.kids.get("k1").present, true);
});

test("goals accumulate and flags toggle", () => {
  const state = fold(
    [
      ev(0, "game_start"),
      ev(30, "goal", { kid: "k2" }),
      ev(90, "goal", { kid: "k2" }),
      ev(100, "flag", { kid: "k2", flag: "star" }),
      ev(110, "flag", { kid: "k2", flag: "shy" }),
      ev(120, "flag", { kid: "k2", flag: "star" }),
    ],
    roster,
    200,
  );
  const mia = state.kids.get("k2");
  assert.equal(mia.goals, 2);
  assert.deepEqual([...mia.flags], ["shy"]);
});

test("notes keep their timestamp and who was on at the time", () => {
  const state = fold(
    [
      ev(0, "game_start"),
      ev(0, "sub_in", { kid: "k1" }),
      ev(60, "note", { text: "Judah asked to come off" }),
    ],
    roster,
    120,
  );
  assert.deepEqual(state.notes, [{ t: 60, text: "Judah asked to come off", on: ["k1"] }]);
});

test("undoing a roll call restores exactly the state before it", () => {
  const log = createLog();
  log.append("game_start", {}, 0);
  log.append("sub_in", { kid: "k1" }, 0);
  const before = fold(log.events, roster, 120);
  log.append("roll_call", { on: ["k2", "k3"] }, 120);
  log.undo();
  const after = fold(log.events, roster, 120);
  assert.equal(after.kids.get("k1").onField, before.kids.get("k1").onField);
  assert.equal(after.kids.get("k1").seconds, before.kids.get("k1").seconds);
  assert.equal(after.kids.get("k2").onField, false);
});
