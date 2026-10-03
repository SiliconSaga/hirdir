import { test } from "node:test";
import assert from "node:assert/strict";
import { addKid, editKid, RosterError } from "../src/roster.js";

const roster = [
  { id: "k1", name: "Ada", jersey: "1" },
  { id: "k2", name: "Bjorn", jersey: null },
];

test("a kid joins at the end of the list with the next free id", () => {
  const next = addKid(roster, { name: "Cleo", jersey: "3" });
  assert.equal(next.length, 3);
  assert.deepEqual(next[2], { id: "k3", name: "Cleo", jersey: "3" });
  assert.deepEqual(next.slice(0, 2), roster); // the original order is untouched
});

test("the next id clears the highest in use, not the roster length", () => {
  // A roster can arrive with gaps — ids are stable and the log points at them,
  // so reusing k3 here would hand a new child another child's minutes.
  const gappy = [{ id: "k1", name: "Ada" }, { id: "k5", name: "Esme" }];
  assert.equal(addKid(gappy, { name: "Finn" })[2].id, "k6");
});

test("a kid with no name is refused", () => {
  assert.throws(() => addKid(roster, { name: "  " }), RosterError);
  assert.throws(() => addKid(roster, {}), RosterError);
});

test("names and jerseys are trimmed, and a blank jersey is no jersey", () => {
  const next = addKid(roster, { name: "  Dev  ", jersey: "  7 " });
  assert.equal(next[2].name, "Dev");
  assert.equal(next[2].jersey, "7");
  assert.equal(addKid(roster, { name: "Esme", jersey: "   " })[2].jersey, null);
  assert.equal(addKid(roster, { name: "Finn" })[2].jersey, null);
});

test("a jersey too long to fit the slot is refused", () => {
  assert.throws(() => addKid(roster, { name: "Gita", jersey: "12345" }), RosterError);
});

test("a number for a jersey is kept as text, so 00 survives", () => {
  assert.equal(addKid(roster, { name: "Hugo", jersey: 9 })[2].jersey, "9");
  assert.equal(addKid(roster, { name: "Iris", jersey: "00" })[2].jersey, "00");
});

test("renaming keeps the id, so the game log still points at the same child", () => {
  const next = editKid(roster, "k1", { name: "Ada B." });
  assert.deepEqual(next[0], { id: "k1", name: "Ada B.", jersey: "1" });
});

test("a jersey can be set, changed and cleared without touching the name", () => {
  assert.equal(editKid(roster, "k2", { jersey: "4" })[1].jersey, "4");
  assert.equal(editKid(roster, "k2", { jersey: "4" })[1].name, "Bjorn");
  assert.equal(editKid(roster, "k1", { jersey: "" })[0].jersey, null);
});

test("editing a kid who is not on the roster changes nothing", () => {
  assert.deepEqual(editKid(roster, "k99", { name: "Nobody" }), roster);
});

test("an edit that would leave a kid nameless is refused", () => {
  assert.throws(() => editKid(roster, "k1", { name: "" }), RosterError);
});
