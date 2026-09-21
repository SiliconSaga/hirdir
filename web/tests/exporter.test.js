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

test("a name that would read as a spreadsheet formula is neutralised", () => {
  for (const [name, expected] of [
    ["=1+1", "'=1+1"],
    ["+Ada", "'+Ada"],
    ["-Bo", "'-Bo"],
    ["@Cy", "'@Cy"],
    ["\tDee", "'\tDee"],
  ]) {
    const state = fold([ev(0, "game_start")], [{ id: "k1", name, jersey: 1 }], 60);
    const row = toCsv(state, 60, 4).split("\n")[1];
    assert.ok(row.startsWith(expected), `${JSON.stringify(name)} produced ${row}`);
  }
});

test("numbers stay numeric, so a negative fair-share difference is not quoted", () => {
  const solo = [{ id: "k1", name: "Ada", jersey: 1 }];
  const state = fold([ev(0, "game_start"), ev(0, "sub_in", { kid: "k1" })], solo, 600);
  // 10 minutes played; fair share is 600s x 4 per side / 1 kid = 40 minutes
  assert.equal(toCsv(state, 600, 4).split("\n")[1], "Ada,1,✓,10,-30,0,,,,");
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
