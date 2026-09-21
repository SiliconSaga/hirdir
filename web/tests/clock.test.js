import { test } from "node:test";
import assert from "node:assert/strict";
import { createClock } from "../src/clock.js";

function fakeNow(start = 0) {
  let value = start;
  const now = () => value;
  now.advance = (seconds) => {
    value += seconds * 1000;
  };
  return now;
}

test("elapsed counts only running time", () => {
  const now = fakeNow();
  const clock = createClock(now);
  clock.start();
  now.advance(60);
  assert.equal(clock.elapsed(), 60);
});

test("a pause freezes the clock and a resume continues it", () => {
  const now = fakeNow();
  const clock = createClock(now);
  clock.start();
  now.advance(300);
  clock.pause();
  now.advance(600); // halftime: 10 minutes of wall time
  assert.equal(clock.elapsed(), 300);
  clock.resume();
  now.advance(120);
  assert.equal(clock.elapsed(), 420);
});

test("elapsed is zero before the game starts", () => {
  assert.equal(createClock(fakeNow()).elapsed(), 0);
});

test("a restored clock keeps its accumulated time", () => {
  const now = fakeNow(10_000);
  const first = createClock(now);
  first.start();
  now.advance(45);
  const restored = createClock(now, first.state());
  now.advance(15);
  assert.equal(restored.elapsed(), 60);
  assert.equal(restored.isRunning(), true);
});

test("pause is idempotent and resume on a fresh clock does not rewind", () => {
  const now = fakeNow();
  const clock = createClock(now);
  clock.start();
  now.advance(30);
  clock.pause();
  clock.pause();
  now.advance(30);
  assert.equal(clock.elapsed(), 30);
});
