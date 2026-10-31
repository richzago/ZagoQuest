/**
 * Synthetic, deterministic-size headless benchmark (NOT a multiplayer load test).
 * Run from server/: npm run bench:tick
 * Measures tickWorld with real World/Monster/AI but no network, PostgreSQL or Unity.
 */
import { performance } from "node:perf_hooks";
import { World } from "../src/game/world/World";
import { Player } from "../src/game/entities/player";
import { Monster } from "../src/game/entities/monster";
import { MonsterAI } from "../src/game/ai/monsterAi";
import { Logger } from "../src/game/core/logger/logger";
import { LoggerConfig } from "../src/game/core/logger/loggerConfig";
import { tickWorld, GAME_TICK_MS } from "../src/game/core/gameStarter";
import { TickMetrics } from "../src/game/core/tickMetrics";
import type { MonsterType } from "../src/shared/interfaces/monster.interface";
import type { WebSocketServer } from "../src/network/websocket/wsServer";

const definition: MonsterType = {
  id: "benchmark-passive", name: "Benchmark", level: 1,
  stats: { hp: 100, speed: 100 },
  combat: { xp: 1, damageMin: 0, damageMax: 0 },
  ai: { type: "passive" },
  visual: { symbol: "B" },
  loot: [],
};
const silentTransport = {
  broadcastMove() {}, broadcastDespawn() {}, sendToPlayer() {},
} as unknown as WebSocketServer;

function measure(monsters: number, ticks = 400) {
  const world = new World();
  world.generateMap(64, 64);
  world.addPlayer(new Player("bench-player", "BenchmarkPlayer", 2, 2));
  for (let i = 0; i < monsters; i++) {
    const x = 8 + (i % 48), y = 8 + (Math.floor(i / 48) % 48);
    world.addMonster(new Monster(
      "bench-" + i, definition, x, y, new MonsterAI(), 2, 40, "bench-spawn-" + i,
    ));
  }
  const metrics = new TickMetrics(512, GAME_TICK_MS);
  const beforeCpu = process.cpuUsage();
  const before = performance.now();
  // Warmup excluded from samples.
  for (let i = 0; i < 30; i++) tickWorld(world, silentTransport);
  for (let i = 0; i < ticks; i++) {
    const start = performance.now();
    tickWorld(world, silentTransport);
    metrics.record(performance.now() - start);
  }
  const elapsedMs = performance.now() - before;
  const cpu = process.cpuUsage(beforeCpu);
  const memory = process.memoryUsage();
  const snapshot = metrics.snapshot();
  console.log(JSON.stringify({
    scenario: "headless-world-ai", monsters, players: 1, ticks,
    tickBudgetMs: GAME_TICK_MS, p50Ms: +snapshot.p50Ms.toFixed(3),
    p95Ms: +snapshot.p95Ms.toFixed(3), p99Ms: +snapshot.p99Ms.toFixed(3),
    maxMs: +snapshot.maxMs.toFixed(3), slowTicks: snapshot.slowTicks,
    elapsedMs: +elapsedMs.toFixed(2),
    cpuTimeMs: +((cpu.user + cpu.system) / 1000).toFixed(1),
    rssMb: +(memory.rss / 1048576).toFixed(1),
    heapUsedMb: +(memory.heapUsed / 1048576).toFixed(1),
    platform: process.platform, node: process.version,
  }));
}

const previous = LoggerConfig.fileLogging;
LoggerConfig.fileLogging = false;
Logger.setConsoleOutput(false);
try {
  for (const monsters of [0, 25, 100, 250]) measure(monsters);
} finally {
  Logger.setConsoleOutput(true);
  LoggerConfig.fileLogging = previous;
}
