import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ensureStableDataRoot } from "../lib/discovery.mjs";
import { stableDataRoot } from "../lib/constants.mjs";

test("environment-discovered data directory is exposed and conflicts are refused", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "toonflow-discovery-"));
  const real = path.join(dir, "install", "data");
  const root = path.join(dir, "stable");
  fs.mkdirSync(real, { recursive: true });
  fs.writeFileSync(path.join(real, "settings.json"), "{}", "utf8");
  const env = { ...process.env, HOME: dir, USERPROFILE: dir, TOONFLOW_DATA_DIR: real };
  const result = ensureStableDataRoot(env, root);
  assert.equal(result.ok, true);
  assert.equal(result.discovery.source, "TOONFLOW_DATA_DIR");
  assert.ok(fs.existsSync(path.join(root, "settings.json")));

  const conflict = path.join(dir, "conflict");
  fs.mkdirSync(conflict, { recursive: true });
  const rejected = ensureStableDataRoot(env, conflict);
  assert.equal(rejected.ok, false);
  assert.match(rejected.reason, /points elsewhere/);
  fs.rmSync(dir, { recursive: true, force: true });
});
