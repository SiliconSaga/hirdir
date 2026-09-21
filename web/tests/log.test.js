import { test } from "node:test";
import assert from "node:assert/strict";
import { createLog } from "../src/log.js";

test("append stamps a 1-based sequence and keeps the given clock time", () => {
  const log = createLog();
  const first = log.append("game_start", {}, 0);
  const second = log.append("sub_in", { kid: "k1" }, 12);
  assert.deepEqual(first, { seq: 1, t: 0, type: "game_start" });
  assert.deepEqual(second, { seq: 2, t: 12, type: "sub_in", kid: "k1" });
  assert.equal(log.size(), 2);
});

test("undo removes the last event and returns it", () => {
  const log = createLog();
  log.append("game_start", {}, 0);
  const removed = log.append("goal", { kid: "k2" }, 30);
  assert.deepEqual(log.undo(), removed);
  assert.equal(log.size(), 1);
});

test("undo on an empty log returns null rather than throwing", () => {
  assert.equal(createLog().undo(), null);
});

test("a log restored from events continues its sequence", () => {
  const log = createLog([{ seq: 1, t: 0, type: "game_start" }]);
  assert.equal(log.append("sub_in", { kid: "k1" }, 5).seq, 2);
});

test("t is rounded to whole seconds", () => {
  assert.equal(createLog().append("sub_in", { kid: "k1" }, 12.7).t, 13);
});
