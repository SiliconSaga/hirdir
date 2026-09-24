import { test } from "node:test";
import assert from "node:assert/strict";
import { browserBacking, createStorage } from "../src/storage.js";

function memoryBacking() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

const doc = {
  v: 1,
  team: "LK",
  onFieldTarget: 5,
  roster: [{ id: "k1", name: "Ada", jersey: null }],
  clock: {},
  events: [{ seq: 1, t: 0, type: "game_start" }],
};

test("a saved document round-trips", () => {
  const storage = createStorage(memoryBacking());
  storage.save(doc);
  assert.deepEqual(storage.load(), doc);
});

test("an empty backing loads as null", () => {
  assert.equal(createStorage(memoryBacking()).load(), null);
});

test("unparseable data loads as null rather than throwing", () => {
  const backing = memoryBacking();
  backing.setItem("hirdir.game", "{not json");
  assert.equal(createStorage(backing).load(), null);
});

test("a document from a future schema version is ignored", () => {
  const backing = memoryBacking();
  backing.setItem("hirdir.game", JSON.stringify({ ...doc, v: 99 }));
  assert.equal(createStorage(backing).load(), null);
});

test("a backing that throws on write does not take the app down", () => {
  const storage = createStorage({
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  });
  assert.doesNotThrow(() => storage.save(doc));
  assert.equal(storage.load(), null);
});

test("a document that no longer looks like one is ignored", () => {
  for (const broken of [
    { ...doc, roster: "everyone" },
    { ...doc, roster: [{ id: "k1" }] },
    { ...doc, events: [{ type: "sub_in" }] }, // no clock time
    { ...doc, onFieldTarget: 0 },
    { ...doc, onFieldTarget: "four" },
    { v: 1 },
  ]) {
    const backing = memoryBacking();
    backing.setItem("hirdir.game", JSON.stringify(broken));
    assert.equal(createStorage(backing).load(), null, JSON.stringify(broken).slice(0, 60));
  }
});

test("a localStorage that throws on access still yields a working store", () => {
  const hostile = {
    get localStorage() {
      throw new Error("site data blocked");
    },
  };
  const backing = browserBacking(hostile);
  const storage = createStorage(backing);
  assert.doesNotThrow(() => storage.save(doc));
  assert.deepEqual(storage.load(), doc); // the in-memory fallback still works
});

test("clear removes the document", () => {
  const storage = createStorage(memoryBacking());
  storage.save(doc);
  storage.clear();
  assert.equal(storage.load(), null);
});
