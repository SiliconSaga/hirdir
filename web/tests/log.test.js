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
  assert.deepEqual(log.undo(), [removed]);
  assert.equal(log.size(), 1);
});

test("undo on an empty log returns nothing rather than throwing", () => {
  assert.deepEqual(createLog().undo(), []);
});

test("undo takes back a whole group, so a swap goes back together", () => {
  const log = createLog();
  log.append("game_start", {}, 0);
  const group = log.nextGroup();
  log.append("sub_out", { kid: "k1" }, 60, group);
  log.append("sub_in", { kid: "k2" }, 60, group);
  const removed = log.undo();
  assert.deepEqual(
    removed.map((e) => e.type),
    ["sub_in", "sub_out"],
  );
  assert.equal(log.size(), 1);
});

test("undo stops at the group boundary", () => {
  const log = createLog();
  const first = log.nextGroup();
  log.append("sub_out", { kid: "k1" }, 0, first);
  log.append("sub_in", { kid: "k2" }, 0, first);
  const second = log.nextGroup();
  log.append("sub_out", { kid: "k2" }, 60, second);
  log.append("sub_in", { kid: "k3" }, 60, second);
  assert.equal(log.undo().length, 2);
  assert.equal(log.size(), 2);
  assert.equal(log.events.at(-1).kid, "k2");
});

test("group ids are distinct", () => {
  const log = createLog();
  assert.notEqual(log.nextGroup(), log.nextGroup());
});

test("a log restored from events continues its sequence", () => {
  const log = createLog([{ seq: 1, t: 0, type: "game_start" }]);
  assert.equal(log.append("sub_in", { kid: "k1" }, 5).seq, 2);
});

test("t is rounded to whole seconds", () => {
  assert.equal(createLog().append("sub_in", { kid: "k1" }, 12.7).t, 13);
});
