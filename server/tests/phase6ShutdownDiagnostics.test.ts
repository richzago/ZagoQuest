/** Shutdown watchdog: warn instead of timing out/deleting unsaved data. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createShutdownController, type ShutdownDependencies } from "../src/game/core/shutdownHandler";

test("shutdown warns on slow WebSocket but never closes PG before release/final flush", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const calls: string[] = [];
  const warnings: string[] = [];
  let release!: () => void;
  const deps: ShutdownDependencies = {
    stopGameLoop: () => { calls.push("stop"); },
    closeWebSocket: async () => {
      calls.push("socket-start");
      await new Promise<void>((resolve) => { release = resolve; });
      calls.push("socket-end");
    },
    closeHttp: async () => { calls.push("http"); },
    stopWorldRuntime: () => { calls.push("world"); },
    waitForJobs: async () => { calls.push("guild"); },
    flushAutosave: async () => { calls.push("save"); },
    closeDatabase: async () => { calls.push("db"); },
  };
  const controller = createShutdownController(deps, {
    warningAfterMs: 5,
    onSlowStep: (step) => warnings.push(step),
  });
  try {
    const shutdown = controller.shutdown("SIGTERM");
    for (let i = 0; i < 8; i++) await Promise.resolve();
    assert.deepEqual(calls, ["stop", "socket-start"]);
    t.mock.timers.tick(10);
    assert.deepEqual(warnings, ["WebSocket"]);
    assert.equal(calls.includes("db"), false);
    release();
    assert.equal(await shutdown, 0);
    assert.deepEqual(calls, ["stop", "socket-start", "socket-end",
      "http", "world", "guild", "save", "db"]);
    t.mock.timers.tick(20);
    assert.deepEqual(warnings, ["WebSocket"]); // no orphan timers
  } finally {
    if (release) release();
    t.mock.timers.reset();
  }
});

test("invalid shutdown warning configuration is rejected", () => {
  const deps = {} as ShutdownDependencies;
  for (const value of [-1, 1.5, NaN]) {
    assert.throws(() => createShutdownController(deps, { warningAfterMs: value }),
      /warningAfterMs/);
  }
});
