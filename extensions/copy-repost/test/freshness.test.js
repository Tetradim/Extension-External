import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const freshnessPath = path.resolve("extensions/copy-repost/src/freshness.js");

async function loadFreshness() {
  const source = await readFile(freshnessPath, "utf8");
  const sandbox = {
    window: {},
    Date,
    Number,
    String
  };
  sandbox.globalThis = sandbox;

  vm.runInNewContext(source, sandbox, { filename: freshnessPath });

  return sandbox.window.CopyRepostFreshness;
}

test("payloadFreshness accepts Discord messages inside the configured window", async () => {
  const freshness = await loadFreshness();

  const result = freshness.payloadFreshness(
    { timestampIso: "2026-06-25T18:58:00.000Z" },
    { nowMs: Date.parse("2026-06-25T19:00:00.000Z"), maxAgeMinutes: 10 }
  );

  assert.equal(result.fresh, true);
});

test("payloadFreshness rejects Discord messages older than the configured window", async () => {
  const freshness = await loadFreshness();

  const result = freshness.payloadFreshness(
    { timestampIso: "2026-06-25T18:40:00.000Z" },
    { nowMs: Date.parse("2026-06-25T19:00:00.000Z"), maxAgeMinutes: 10 }
  );

  assert.equal(result.fresh, false);
  assert.equal(result.reason, "message older than freshness window");
});

test("payloadFreshness rejects messages without a Discord timestamp", async () => {
  const freshness = await loadFreshness();

  const result = freshness.payloadFreshness(
    { capturedAt: "2026-06-25T19:00:00.000Z" },
    { nowMs: Date.parse("2026-06-25T19:00:00.000Z"), maxAgeMinutes: 10 }
  );

  assert.equal(result.fresh, false);
  assert.equal(result.reason, "missing Discord timestamp");
});

test("normalizeFreshnessWindowMinutes clamps invalid popup values to the default", async () => {
  const freshness = await loadFreshness();

  assert.equal(freshness.normalizeFreshnessWindowMinutes("not a number"), 10);
  assert.equal(freshness.normalizeFreshnessWindowMinutes(0), 10);
  assert.equal(freshness.normalizeFreshnessWindowMinutes(1441), 10);
  assert.equal(freshness.normalizeFreshnessWindowMinutes("15"), 15);
});
