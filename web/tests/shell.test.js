import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const web = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const sw = readFileSync(web("sw.js"), "utf8");
const cached = [...sw.matchAll(/"([^"]+\.(?:js|css|html|webmanifest))"/g)].map((m) => m[1]);

test("every module the app loads is in the service worker's shell list", () => {
  // A module missing here is invisible until someone opens the app with no
  // signal, which is the one moment it has to work.
  const modules = readdirSync(web("src")).filter((name) => name.endsWith(".js"));
  for (const name of modules) {
    assert.ok(
      cached.includes(`src/${name}`),
      `src/${name} is not cached by sw.js — add it to SHELL and bump CACHE`,
    );
  }
});

test("the page's own assets are cached too", () => {
  const html = readFileSync(web("index.html"), "utf8");
  const referenced = [...html.matchAll(/(?:href|src)="([^":]+\.(?:css|js|webmanifest))"/g)].map(
    (m) => m[1],
  );
  for (const asset of referenced) {
    assert.ok(cached.includes(asset), `${asset} is referenced by index.html but not cached`);
  }
});

test("the cache name carries a version, so a shell change can invalidate it", () => {
  assert.match(sw, /CACHE_PREFIX\}v\d+`/);
});
