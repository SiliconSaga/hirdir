import { test } from "node:test";
import assert from "node:assert/strict";
import { createClock, MAX_GAME_SECONDS, overran, suggestedEnd } from "../src/clock.js";

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

test("a game is flagged only once it runs past the cap", () => {
  assert.equal(overran(90 * 60), false); // a long session is still plausible
  assert.equal(overran(MAX_GAME_SECONDS), false);
  assert.equal(overran(MAX_GAME_SECONDS + 1), true);
  assert.equal(overran(14 * 60 * 60), true); // left running overnight
});

test("the suggested end time is the last recorded event plus a grace", () => {
  const events = [
    { t: 0, type: "game_start" },
    { t: 2280, type: "sub_in", kid: "k1" }, // 38 minutes
  ];
  assert.equal(suggestedEnd(events, 14 * 60 * 60), 2280 + 300); // 43 minutes
});

test("the suggestion never exceeds the clock actually run", () => {
  const events = [{ t: 100, type: "goal", kid: "k1" }];
  assert.equal(suggestedEnd(events, 200), 200);
});

test("a game with nothing recorded suggests the grace itself", () => {
  assert.equal(suggestedEnd([], 9999), 300);
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
