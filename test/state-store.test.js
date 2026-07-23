import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadMonitorState, saveMonitorState } from "../src/state-store.js";

test("missing state is allowed only for first-run initialization", async () => {
  const directory = await mkdtemp(join(tmpdir(), "meteora-state-"));
  const path = join(directory, "missing.json");
  assert.equal(await loadMonitorState(path), null);
  await assert.rejects(
    loadMonitorState(path, { required: true }),
    /Monitor state is missing/
  );
});

test("state is saved atomically and loaded without losing accounting fields", async () => {
  const directory = await mkdtemp(join(tmpdir(), "meteora-state-"));
  const path = join(directory, "nested", "monitor.json");
  const state = {
    month: "2026-07",
    monthlyBaselineFeesUsd: 12.5,
    dailySnapshots: [{ date: "2026-07-23", netPnlUsd: 4.2 }]
  };

  await saveMonitorState(path, state);

  assert.deepEqual(await loadMonitorState(path), state);
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), state);
});

test("corrupt state fails visibly instead of resetting financial history", async () => {
  const directory = await mkdtemp(join(tmpdir(), "meteora-state-"));
  const path = join(directory, "monitor.json");
  await writeFile(path, "{not-json", "utf8");

  await assert.rejects(loadMonitorState(path), /Unable to load monitor state/);
});
