/**
 * Testes determinísticos: timers simulados e dependências injetadas.
 * Não há PostgreSQL, rede nem esperas reais de 60 segundos/24 horas.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { Player } from "../src/game/entities/player";
import {
  SCHEDULED_INTERVALS,
  startScheduledTasks,
  type ScheduledTaskDependencies,
} from "../src/game/core/scheduledTasks";

type Timer = ReturnType<typeof setInterval>;
type Callback = () => void;

function harness(overrides: Partial<ScheduledTaskDependencies> = {}) {
  let nextId = 0;
  const timers = new Map<number, { callback: Callback; intervalMs: number }>();

  const deps: ScheduledTaskDependencies = {
    saveCharacter: async () => {},
    processGuildInactivity: async () => {},
    // Guarda callbacks e intervalos sem criar timers reais.
    schedule: (callback, intervalMs) => {
      const id = ++nextId;
      timers.set(id, { callback, intervalMs });
      return id as unknown as Timer;
    },
    cancel: (timer) => { timers.delete(timer as unknown as number); },
    ...overrides,
  };

  const fire = (intervalMs: number) => {
    for (const timer of timers.values()) {
      if (timer.intervalMs === intervalMs) timer.callback();
    }
  };
  return { deps, timers, fire };
}

const player = () => new Player("scheduled-test", "SchedulerTester", 2, 2);
// Avança Promises e callbacks .then() sem modificar o relógio real.
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

test("intervalos corretos: autosave 60s e guildas 24h (não 14m24s)", () => {
  const h = harness();
  const task = startScheduledTasks(player(), h.deps);
  try {
    assert.equal(SCHEDULED_INTERVALS.autosave, 60_000);
    assert.equal(SCHEDULED_INTERVALS.guildInactivity, 86_400_000);
    assert.deepEqual(
      [...h.timers.values()].map((t) => t.intervalMs).sort((a, b) => a - b),
      [60_000, 86_400_000],
    );
  } finally {
    task.stop();
  }
});

test("tarefas não executam imediatamente ao iniciar o scheduler", async () => {
  let saves = 0, guilds = 0;
  const h = harness({
    saveCharacter: async () => { saves++; },
    processGuildInactivity: async () => { guilds++; },
  });
  const task = startScheduledTasks(player(), h.deps);
  try {
    await settle();
    assert.equal(saves, 0);
    assert.equal(guilds, 0);

    h.fire(SCHEDULED_INTERVALS.autosave);
    await settle();
    assert.equal(saves, 1);
    assert.equal(guilds, 0);

    h.fire(SCHEDULED_INTERVALS.guildInactivity);
    await settle();
    assert.equal(guilds, 1);
  } finally {
    task.stop();
  }
});

test("iniciar duas vezes não registra timers duplicados", () => {
  const h = harness();
  const current = startScheduledTasks(player(), h.deps);
  try {
    assert.equal(startScheduledTasks(player(), h.deps), current);
    assert.equal(h.timers.size, 2);
  } finally {
    current.stop();
  }
  assert.equal(h.timers.size, 0);
});

test("stop limpa timers e permite iniciar novamente", async () => {
  let saves = 0;
  const h = harness({ saveCharacter: async () => { saves++; } });
  const first = startScheduledTasks(player(), h.deps);
  const callbacks = [...h.timers.values()].map((t) => t.callback);
  first.stop();
  first.stop(); // stop é idempotente.

  assert.equal(h.timers.size, 0);
  callbacks.forEach((fn) => fn()); // Callback antigo não pode produzir ações.
  await settle();
  assert.equal(saves, 0);

  const second = startScheduledTasks(player(), h.deps);
  try {
    assert.notEqual(first, second);
    h.fire(SCHEDULED_INTERVALS.autosave);
    await settle();
    assert.equal(saves, 1);
  } finally {
    second.stop();
  }
});

test("autosave lento nunca dispara duas gravações concorrentes", async () => {
  let calls = 0;
  let release!: () => void;
  const h = harness({
    saveCharacter: () => {
      calls++;
      return new Promise<void>((resolve) => { release = resolve; });
    },
  });
  const task = startScheduledTasks(player(), h.deps);
  try {
    h.fire(SCHEDULED_INTERVALS.autosave);
    await settle();
    h.fire(SCHEDULED_INTERVALS.autosave);
    h.fire(SCHEDULED_INTERVALS.autosave);
    await settle();
    assert.equal(calls, 1);

    release();
    await settle();
    h.fire(SCHEDULED_INTERVALS.autosave);
    await settle();
    assert.equal(calls, 2);
    release();
    await settle();
  } finally {
    task.stop();
  }
});

test("falha no autosave é tratada e o próximo tick tenta novamente", async () => {
  let calls = 0;
  const h = harness({
    saveCharacter: async () => {
      calls++;
      if (calls === 1) throw new Error("Banco temporariamente indisponível");
    },
  });
  const task = startScheduledTasks(player(), h.deps);
  try {
    h.fire(SCHEDULED_INTERVALS.autosave);
    await settle();
    h.fire(SCHEDULED_INTERVALS.autosave);
    await settle();
    assert.equal(calls, 2);
  } finally {
    task.stop();
  }
});

test("guildas não processam inatividade em paralelo", async () => {
  let calls = 0;
  let release!: () => void;
  const h = harness({
    processGuildInactivity: () => {
      calls++;
      return new Promise<void>((resolve) => { release = resolve; });
    },
  });
  const task = startScheduledTasks(player(), h.deps);
  try {
    h.fire(SCHEDULED_INTERVALS.guildInactivity);
    await settle();
    h.fire(SCHEDULED_INTERVALS.guildInactivity);
    await settle();
    assert.equal(calls, 1);

    release();
    await settle();
    h.fire(SCHEDULED_INTERVALS.guildInactivity);
    await settle();
    assert.equal(calls, 2);
    release();
    await settle();
  } finally {
    task.stop();
  }
});

test("falha na rotina de guildas é tratada sem impedir próximas execuções", async () => {
  let calls = 0;
  const h = harness({
    processGuildInactivity: async () => {
      calls++;
      if (calls === 1) throw new Error("Falha na consulta de guildas");
    },
  });
  const task = startScheduledTasks(player(), h.deps);
  try {
    h.fire(SCHEDULED_INTERVALS.guildInactivity);
    await settle();
    h.fire(SCHEDULED_INTERVALS.guildInactivity);
    await settle();
    assert.equal(calls, 2);
  } finally {
    task.stop();
  }
});

test("flushAutosave aguarda um save em andamento e salva estado atualizado", async () => {
  const p = player();
  let calls = 0;
  let release!: () => void;
  const snapshots: number[] = [];
  const h = harness({
    saveCharacter: async (current) => {
      calls++;
      if (calls === 1) {
        snapshots.push(current.gold);
        await new Promise<void>((resolve) => { release = resolve; });
      } else {
        snapshots.push(current.gold);
      }
    },
  });
  p.gold = 10;
  const task = startScheduledTasks(p, h.deps);
  try {
    h.fire(SCHEDULED_INTERVALS.autosave);
    await settle();
    assert.equal(calls, 1);
    assert.deepEqual(snapshots, [10]);

    p.gold = 25;
    const final = task.flushAutosave();
    assert.equal(h.timers.size, 0);
    await settle();
    assert.equal(calls, 1); // Ainda aguardando a primeira gravação.

    release();
    await final;
    assert.equal(calls, 2);
    assert.deepEqual(snapshots, [10, 25]); // O estado mais recente foi salvo.
  } finally {
    task.stop();
  }
});

test("flushAutosave é idempotente e não gera salvamentos finais duplicados", async () => {
  let calls = 0;
  const h = harness({ saveCharacter: async () => { calls++; } });
  const task = startScheduledTasks(player(), h.deps);
  try {
    const first = task.flushAutosave();
    const second = task.flushAutosave();
    assert.equal(first, second);
    await Promise.all([first, second]);
    assert.equal(calls, 1);
    assert.equal(h.timers.size, 0);
  } finally {
    task.stop();
  }
});

test("falha no salvamento final é propagada para o shutdown", async () => {
  const h = harness({
    saveCharacter: async () => { throw new Error("PostgreSQL offline"); },
  });
  const task = startScheduledTasks(player(), h.deps);
  try {
    await assert.rejects(task.flushAutosave(), /PostgreSQL offline/);
  } finally {
    task.stop();
  }
});

test("falha anterior não impede última tentativa no shutdown", async () => {
  let calls = 0;
  const h = harness({
    saveCharacter: async () => {
      calls++;
      if (calls === 1) throw new Error("Falha anterior");
    },
  });
  const task = startScheduledTasks(player(), h.deps);
  try {
    h.fire(SCHEDULED_INTERVALS.autosave);
    // Executa a primeira gravação, mas ainda há um save anterior a considerar.
    await settle();
    await task.flushAutosave();
    assert.equal(calls, 2);
  } finally {
    task.stop();
  }
});
