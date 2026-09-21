import { test } from "node:test";
import assert from "node:assert/strict";
import { fold } from "../src/fold.js";
import { toCsv, toJson } from "../src/exporter.js";

const roster = [
  { id: "k1", name: "Judah", jersey: 1 },
  { id: "k2", name: "Mia", jersey: null },
];
const ev = (t, type, fields = {}) => ({ seq: 0, t, type, ...fields });

const events = [
  ev(0, "game_start"),
  ev(0, "sub_in", { kid: "k1" }),
  ev(600, "goal", { kid: "k1" }),
  ev(900, "sub_out", { kid: "k1" }),
  ev(0, "absent", { kid: "k2" }),
  ev(1800, "game_end"),
];

test("the CSV header matches the workbook's game-sheet columns", () => {
  const state = fold(events, roster, 1800);
  const [header] = toCsv(state, 1800, 4).split("\n");
  assert.equal(
    header,
    "Player,Jersey,Here,Minutes played,+/- fair,Goals,Star,Shy,Needs help,Notes",
  );
});

test("a row carries minutes, fair-share difference and goals", () => {
  const state = fold(events, roster, 1800);
  const rows = toCsv(state, 1800, 4).split("\n");
  // 30 min x 4 per side / 1 kid present = 120 min fair share; Judah played 15
  assert.equal(rows[1], "Judah,1,✓,15,-105,1,,,,");
});

test("an absent kid is marked A with no minutes", () => {
  const state = fold(events, roster, 1800);
  const rows = toCsv(state, 1800, 4).split("\n");
  assert.equal(rows[2], "Mia,,A,0,,0,,,,");
});

test("a name containing a comma is quoted", () => {
  const state = fold([ev(0, "game_start")], [{ id: "k1", name: "Ada, Jr", jersey: 7 }], 60);
  assert.match(toCsv(state, 60, 4), /"Ada, Jr"/);
});

test("the JSON export is the whole document, pretty-printed", () => {
  const doc = { v: 1, team: "LK", events };
  const parsed = JSON.parse(toJson(doc));
  assert.equal(parsed.events.length, events.length);
  assert.match(toJson(doc), /\n {2}/);
});
