/**
 * Tests the lifecycle without starting PostgreSQL, Unity or the real game loop.
 * HTTP listen and signal handling are exercised with actual Node primitives.
 */
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import type { WebSocketServer } from "../src/network/websocket/wsServer";
import { World } from "../src/game/world/World";
import { Player } from "../src/game/entities/player";
import { Npc } from "../src/game/entities/npc";
import { Monster } from "../src/game/entities/monster";
import { MonsterAI } from "../src/game/ai/monsterAi";
import { MonsterRegistry } from "../src/data/monsters/monsterRegistry";
import { DeathSystem } from "../src/game/systems/deathSystem";
import { NpcInteractionSystem } from "../src/game/systems/npcInteractionSystem";
import type { MonsterType } from "../src/shared/interfaces/monster.interface";
import {
  GAME_TICK_MS,
  startGameLoops,
  type GameLoopDependencies,
} from "../src/game/core/gameStarter";
import { stopWorldRuntime } from "../src/game/core/worldCleanup";
import {
  createShutdownController,
  setupGracefulShutdown,
  type ShutdownDependencies,
} from "../src/game/core/shutdownHandler";
import {
  closeHttp,
  listenHttp,
  resolveApiPort,
} from "../src/game/core/httpLifecycle";
import { MessageRateLimiter, OrderedMessageQueue } from "../src/network/validation/messageGuards";
import { SCHEDULED_INTERVALS } from "../src/game/core/scheduledTasks";

type Timer = ReturnType<typeof setInterval>;
type TimerData = { callback: () => void; ms: number };
const flushMicrotasks = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

function fakeSchedulers() {
  let id = 0;
  const worldTimers = new Map<number, TimerData>();
  const scheduledTimers = new Map<number, TimerData>();
  const saveSnapshots: number[] = [];
  const scheduleInto = (timers: Map<number, TimerData>) =>
    (callback: () => void, ms: number): Timer => {
      const key = ++id;
      timers.set(key, { callback, ms });
      return key as unknown as Timer;
    };
  const cancelFrom = (timers: Map<number, TimerData>) =>
    (timer: Timer): void => { timers.delete(timer as unknown as number); };

  const deps: GameLoopDependencies = {
    scheduleWorldTick: scheduleInto(worldTimers),
    cancelWorldTick: cancelFrom(worldTimers),
    scheduledTasks: {
      schedule: scheduleInto(scheduledTimers),
      cancel: cancelFrom(scheduledTimers),
      saveCharacter: async (player: Player) => { saveSnapshots.push(player.gold); },
      processGuildInactivity: async () => {},
    },
  };
  return { deps, worldTimers, scheduledTimers, saveSnapshots };
}

function playerWorld() {
  const world = new World();
  world.generateMap(15, 15);
  const player = new Player("lifecycle-test", "Lifecycle", 2, 2);
  world.addPlayer(player);
  return { world, player };
}

function steps(overrides: Partial<ShutdownDependencies> = {}) {
  const calls: string[] = [];
  const deps: ShutdownDependencies = {
    stopGameLoop: () => { calls.push("stopGameLoop"); },
    closeWebSocket: async () => { calls.push("closeWebSocket"); },
    closeHttp: async () => { calls.push("closeHttp"); },
    stopWorldRuntime: () => { calls.push("stopWorldRuntime"); },
    waitForJobs: async () => { calls.push("waitForJobs"); },
    flushAutosave: async () => { calls.push("flushAutosave"); },
    closeDatabase: async () => { calls.push("closeDatabase"); },
    ...overrides,
  };
  return { deps, calls };
}

const expectedShutdownOrder = [
  "stopGameLoop", "closeWebSocket", "closeHttp", "stopWorldRuntime",
  "waitForJobs", "flushAutosave", "closeDatabase",
];

test("game loop tem intervalo de 250ms e agendamentos separados de 60s/24h", () => {
  const f = fakeSchedulers();
  const { world, player } = playerWorld();
  const game = startGameLoops(world, player, {} as WebSocketServer, f.deps);
  try {
    assert.equal(GAME_TICK_MS, 250);
    assert.deepEqual([...f.worldTimers.values()].map(x => x.ms), [GAME_TICK_MS]);
    assert.deepEqual([...f.scheduledTimers.values()].map(x => x.ms).sort((a,b)=>a-b),
      [SCHEDULED_INTERVALS.autosave, SCHEDULED_INTERVALS.guildInactivity].sort((a,b)=>a-b));
  } finally { game.stop(); }
});

test("startGameLoops é idempotente e não cria ticks/autosaves duplicados", () => {
  const f = fakeSchedulers();
  const { world, player } = playerWorld();
  const first = startGameLoops(world, player, {} as WebSocketServer, f.deps);
  try {
    const second = startGameLoops(world, player, {} as WebSocketServer, f.deps);
    assert.equal(first, second);
    assert.equal(f.worldTimers.size, 1);
    assert.equal(f.scheduledTimers.size, 2);
  } finally { first.stop(); }
});

test("stop remove todos os timers e callbacks antigos não rodam", async () => {
  const f = fakeSchedulers();
  const { world, player } = playerWorld();
  const game = startGameLoops(world, player, {} as WebSocketServer, f.deps);
  const savedCallbacks = [...f.worldTimers.values(), ...f.scheduledTimers.values()]
    .map(t => t.callback);
  game.stop();
  game.stop();
  savedCallbacks.forEach(fn => fn());
  await flushMicrotasks();
  assert.equal(f.worldTimers.size, 0);
  assert.equal(f.scheduledTimers.size, 0);
  assert.deepEqual(f.saveSnapshots, []);
});

test("restart após stop gera timers novos e permite flush final", async () => {
  const f = fakeSchedulers();
  const { world, player } = playerWorld();
  const old = startGameLoops(world, player, {} as WebSocketServer, f.deps);
  old.stop();
  const current = startGameLoops(world, player, {} as WebSocketServer, f.deps);
  try {
    assert.notEqual(current, old);
    player.gold = 57;
    await current.flushAutosave();
    assert.deepEqual(f.saveSnapshots, [57]);
    assert.equal(f.scheduledTimers.size, 0);
  } finally { current.stop(); }
});

test("shutdown segue ordem e executa exatamente uma vez com dois sinais", async () => {
  const f = steps();
  const controller = createShutdownController(f.deps);
  const a = controller.shutdown("SIGINT");
  const b = controller.shutdown("SIGTERM");
  assert.equal(a, b);
  assert.deepEqual([await a, await b], [0, 0]);
  assert.deepEqual(f.calls, expectedShutdownOrder);
});

test("shutdown continua até PostgreSQL quando autosave falha e retorna 1", async () => {
  const calls: string[] = [];
  const f = steps({
    flushAutosave: async () => {
      calls.push("save");
      throw new Error("Banco indisponível");
    },
    closeDatabase: async () => { calls.push("db"); },
  });
  assert.equal(await createShutdownController(f.deps).shutdown("SIGTERM"), 1);
  assert.deepEqual(calls, ["save", "db"]);
  assert.ok(f.calls.includes("stopGameLoop"));
});

test("falha WebSocket ou HTTP não impede flush nem liberação do banco", async () => {
  const f = steps({
    closeWebSocket: async () => { throw new Error("socket offline"); },
    closeHttp: async () => { throw new Error("listen offline"); },
  });
  const result = await createShutdownController(f.deps).shutdown("BOOTSTRAP_FAILURE");
  assert.equal(result, 1);
  assert.ok(f.calls.includes("flushAutosave"));
  assert.ok(f.calls.includes("closeDatabase"));
});

test("signal handlers executam shutdown uma vez, removem listeners e reportam código", async () => {
  const emitter = new EventEmitter();
  const f = steps();
  const controller = createShutdownController(f.deps);
  const codes: number[] = [];
  const dispose = setupGracefulShutdown(controller, {
    emitter,
    onComplete: (code) => codes.push(code),
  });
  emitter.emit("SIGINT");
  emitter.emit("SIGTERM");
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(codes, [0]);
  assert.deepEqual(f.calls, expectedShutdownOrder);
  assert.equal(emitter.listenerCount("SIGINT"), 0);
  assert.equal(emitter.listenerCount("SIGTERM"), 0);
  dispose(); // idempotent
});

test("remover signal handler impede shutdown prematuro", async () => {
  const emitter = new EventEmitter();
  const f = steps();
  const dispose = setupGracefulShutdown(createShutdownController(f.deps), {
    emitter, onComplete: () => assert.fail("não deve executar"),
  });
  dispose();
  dispose();
  emitter.emit("SIGTERM");
  await flushMicrotasks();
  assert.deepEqual(f.calls, []);
});

test("resolveApiPort aceita porta 0 e padrão e rejeita valores inválidos", () => {
  assert.equal(resolveApiPort(undefined), 3000);
  assert.equal(resolveApiPort("0"), 0);
  assert.equal(resolveApiPort("54321"), 54321);
  for (const value of ["-1", "65536", "80foo", "abc", " 3000", "1.2", "Infinity"]) {
    assert.throws(() => resolveApiPort(value));
  }
});

test("HTTP listen aguarda bind real e close é idempotente", async () => {
  const server = createServer();
  await listenHttp(server, 0);
  assert.equal(server.listening, true);
  assert.ok((server.address() as AddressInfo).port > 0);
  await closeHttp(server);
  await closeHttp(server);
  assert.equal(server.listening, false);
});

test("HTTP listen rejeita EADDRINUSE pelo evento error (não crash do processo)", async () => {
  const first = createServer();
  const second = createServer();
  try {
    await listenHttp(first, 0);
    const port = (first.address() as AddressInfo).port;
    await assert.rejects(listenHttp(second, port), (error: unknown) =>
      (error as NodeJS.ErrnoException).code === "EADDRINUSE");
    assert.equal(second.listenerCount("error"), 0);
  } finally {
    await closeHttp(second);
    await closeHttp(first);
  }
});

test("HTTP listen rejeita porta inválida antes de criar listener", async () => {
  const server = createServer();
  try {
    await assert.rejects(listenHttp(server, -1), /Porta HTTP inválida/);
    assert.equal(server.listening, false);
  } finally { await closeHttp(server); }
});

test("waitForIdle da fila WebSocket aguarda handler em andamento", async () => {
  let release!: () => void;
  const events: string[] = [];
  const queue = new OrderedMessageQueue(() => assert.fail("handler não deveria falhar"));
  queue.enqueue(async () => {
    await new Promise<void>(resolve => { release = resolve; });
    events.push("finished");
  });
  await flushMicrotasks();
  const pending = queue.whenIdle();
  let done = false;
  void pending.then(() => { done = true; });
  await flushMicrotasks();
  assert.equal(done, false);
  release();
  await pending;
  assert.deepEqual(events, ["finished"]);
});

test("guild job em andamento é aguardado antes do último save", async () => {
  const f = fakeSchedulers();
  let release!: () => void;
  let finished = false;
  f.deps.scheduledTasks!.processGuildInactivity = () =>
    new Promise<void>((resolve) => { release = () => { finished = true; resolve(); }; });
  const { world, player } = playerWorld();
  const game = startGameLoops(world, player, {} as WebSocketServer, f.deps);
  try {
    [...f.scheduledTimers.values()].find(t=>t.ms===SCHEDULED_INTERVALS.guildInactivity)!.callback();
    await flushMicrotasks();

    const shutdown = createShutdownController({
      ...steps().deps,
      stopGameLoop: () => game.stop(),
      waitForJobs: () => game.waitForTasks(),
      flushAutosave: async () => {
        assert.equal(finished, true);
        await game.flushAutosave();
      },
    });
    const closing = shutdown.shutdown("test");
    await flushMicrotasks();
    assert.deepEqual(f.saveSnapshots, []);
    release();
    assert.equal(await closing, 0);
    assert.equal(f.saveSnapshots.length, 1);
  } finally { game.stop(); }
});

test("stopWorldRuntime cancela pesca, NPC e condições sem mexer no gold", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { world, player } = playerWorld();
  const npc = new Npc("bank", "Banco", 3, 2, "Olá", "banker");
  world.addNpc(npc);
  player.gold = 321;
  player.isFishing = true;
  player.fishingTimer = setTimeout(() => assert.fail("pesca não deve terminar"), 1000);
  player.currentTargetId = "monster";

  assert.equal(NpcInteractionSystem.open(player, world, npc, "banker"), true);
  try {
    stopWorldRuntime(world);
    stopWorldRuntime(world);
    assert.equal(player.fishingTimer, undefined);
    assert.equal(player.isFishing, false);
    assert.equal(player.currentTargetId, undefined);
    assert.equal(player.gold, 321);
    assert.equal(NpcInteractionSystem.getActive(player, world, "banker"), undefined);
    t.mock.timers.tick(2000);
  } finally { t.mock.timers.reset(); }
});

test("stopWorldRuntime cancela timers de corpse e respawn, sem ressuscitar monstro", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { world } = playerWorld();
  const type: MonsterType = {
    id: "lifecycle-monster",
    name: "Shutdown Monster",
    level: 1,
    stats: { hp: 3 },
    combat: { xp: 1, damageMin: 1, damageMax: 1 },
    loot: [],
    ai: { type: "passive" },
    visual: { symbol: "S" },
  };
  MonsterRegistry.getAll().set(type.id, type);
  const monster = new Monster("monster", type, 3, 2, new MonsterAI(), 2, 40, "point");
  world.addMonster(monster);
  try {
    monster.hp = 0;
    DeathSystem.handleDeath(monster, undefined, world);
    assert.equal(world.corpses.length, 1);
    world.cleanupDeadMonsters();
    stopWorldRuntime(world);
    t.mock.timers.tick(20_000);
    assert.equal(world.monsters.length, 0);
    // Corpse does not get erased by timer after world stops.
    assert.equal(world.corpses.length, 1);
  } finally { t.mock.timers.reset(); }
});

test("rate limiter remains independent of lifecycle shutdown (regressão)", () => {
  const limit = new MessageRateLimiter();
  assert.equal(limit.allow(1000), true);
  assert.equal(limit.allow(1001), true);
});
