/**
 * CombatEventBridge e PlayerAttackSystem: regressão de dano, eventos,
 * cooldown compartilhado e mortes únicas. Sem banco nem sockets reais.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { Player } from "../src/game/entities/player";
import { Monster } from "../src/game/entities/monster";
import { MonsterAI } from "../src/game/ai/monsterAi";
import { World } from "../src/game/world/World";
import { CombatSystem } from "../src/game/combat/combatSystem";
import { PlayerAttackSystem, PLAYER_ATTACK_COOLDOWN_MS } from "../src/game/combat/playerAttackSystem";
import { CombatEventBridge } from "../src/network/websocket/combatEventBridge";
import { EventSystem } from "../src/game/core/events/eventSystem";
import { GameEvent } from "../src/shared/enums/gameEvent.enum";
import { handleAttack, handleStartAutoAttack } from "../src/network/handlers/attack.handler";
import type { HandlerContext } from "../src/network/handlers/HandlerContext";
import type { WebSocket } from "ws";
import type { MonsterType } from "../src/shared/interfaces/monster.interface";
import type {
  CombatDamageEventData, MonsterDeathEventData,
} from "../src/shared/interfaces/eventData.interface";

const monsterType: MonsterType = {
  id: "combat-events-test",
  name: "Event Monster",
  level: 1,
  stats: { hp: 30 },
  combat: { xp: 4, damageMin: 1, damageMax: 2 },
  loot: [],
  ai: { type: "passive" },
  visual: { symbol: "M" },
};

const create = (worldSize = 20) => {
  const world = new World();
  world.generateMap(worldSize, worldSize);
  const player = new Player("player-1", "Tester", 2, 2);
  const monster = new Monster("monster-1", monsterType, 3, 2, new MonsterAI(), 2, 60000);
  monster.maxHp = 100;
  monster.hp = 100;
  player.attack = 15;
  player.criticalChance = 0;
  world.addPlayer(player);
  world.addMonster(monster);
  return { world, player, monster };
};

function eventsFor(world: World) {
  const damage: Array<{ id: string; hp: number; maxHp: number; damage: number }> = [];
  const messages: Array<{ playerId: string; message: { type: string; monsterId?: string } }> = [];
  const bridge = new CombatEventBridge(world, {
    broadcastDamage(id, hp, maxHp, dealt) {
      damage.push({ id, hp, maxHp, damage: dealt });
    },
    sendToPlayer(playerId, text) {
      messages.push({ playerId, message: JSON.parse(text) });
    },
  });
  return { bridge, damage, messages };
}

function ctx(world: World) {
  const failures: string[] = [];
  const stats: unknown[] = [];
  const context = {
    world,
    broadcast: {
      // Se handler fizer um broadcast direto, estes spies detectarão duplicata.
      broadcastDamage: (...a: unknown[]) => { stats.push(["broadcastDamage", ...a]); },
      broadcastDespawn: (...a: unknown[]) => { stats.push(["broadcastDespawn", ...a]); },
    },
    packetSender: {
      combat: {
        sendAttackFailed: (reason: string) => { failures.push(reason); },
        sendDamage: (...a: unknown[]) => { stats.push(["sendDamage", ...a]); },
        sendMonsterDied: (...a: unknown[]) => { stats.push(["sendMonsterDied", ...a]); },
        sendAutoAttackStopped: (reason: string) => { failures.push(reason); },
        sendAutoAttackStarted: (...a: unknown[]) => { stats.push(["autoAttackStarted", ...a]); },
      },
    },
  } as unknown as HandlerContext;
  return { context, failures, stats };
}

test("ataque do jogador emite um único evento de dano com HP correto", () => {
  const a = create();
  const e = eventsFor(a.world);
  const received: CombatDamageEventData[] = [];
  const subscriber = (v: CombatDamageEventData) => received.push(v);
  EventSystem.getInstance().on(GameEvent.COMBAT_DAMAGE, subscriber);
  try {
    const hpBefore = a.monster.hp;
    const dealt = CombatSystem.attack(a.player, a.monster, a.world);
    assert.equal(received.length, 1);
    assert.equal(e.damage.length, 1);
    assert.equal(e.damage[0].damage, dealt);
    assert.equal(hpBefore - e.damage[0].hp, dealt);
    assert.equal(e.damage[0].maxHp, a.monster.maxHp);
    assert.equal(received[0].world, a.world);
  } finally {
    e.bridge.dispose();
    EventSystem.getInstance().off(GameEvent.COMBAT_DAMAGE, subscriber);
  }
});

test("ataque do monstro contra o player também transmite um dano único", () => {
  const a = create();
  a.monster.attack = 9;
  const e = eventsFor(a.world);
  try {
    const before = a.player.hp;
    const dealt = CombatSystem.attack(a.monster, a.player, a.world);
    assert.equal(e.damage.length, 1);
    assert.equal(e.damage[0].id, a.player.id);
    assert.equal(e.damage[0].damage, dealt);
    assert.equal(before - a.player.hp, dealt);
  } finally { e.bridge.dispose(); }
});

test("múltiplos mundos não recebem eventos uns dos outros", () => {
  const a = create();
  const other = create();
  const ea = eventsFor(a.world);
  const eb = eventsFor(other.world);
  try {
    CombatSystem.attack(a.player, a.monster, a.world);
    assert.equal(ea.damage.length, 1);
    assert.equal(eb.damage.length, 0);
    CombatSystem.attack(other.player, other.monster, other.world);
    assert.equal(ea.damage.length, 1);
    assert.equal(eb.damage.length, 1);
  } finally { ea.bridge.dispose(); eb.bridge.dispose(); }
});

test("bridge.dispose remove listeners e é idempotente", () => {
  const a = create();
  const e = eventsFor(a.world);
  e.bridge.dispose();
  e.bridge.dispose();
  CombatSystem.attack(a.player, a.monster, a.world);
  assert.equal(e.damage.length, 0);
});

test("monstro morto não pode atacar nem emitir dano", () => {
  const a = create();
  const e = eventsFor(a.world);
  try {
    a.monster.hp = 0;
    const dealt = CombatSystem.attack(a.monster, a.player, a.world);
    assert.equal(dealt, 0);
    assert.equal(e.damage.length, 0);
    assert.equal(a.player.hp, a.player.maxHp);
  } finally { e.bridge.dispose(); }
});

test("monstro removido do mundo não pode sofrer novos ataques", () => {
  const a = create();
  const e = eventsFor(a.world);
  try {
    a.world.removeMonster(a.monster);
    assert.equal(CombatSystem.attack(a.player, a.monster, a.world), 0);
    assert.equal(e.damage.length, 0);
  } finally { e.bridge.dispose(); }
});

test("dano reportado corresponde ao HP realmente perdido, não ao overkill", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const a = create();
  a.monster.hp = 1;
  a.player.attack = 200;
  const e = eventsFor(a.world);
  try {
    const dealt = CombatSystem.attack(a.player, a.monster, a.world);
    assert.equal(dealt, 1);
    assert.equal(e.damage.length, 1);
    assert.equal(e.damage[0].damage, 1);
    assert.equal(a.monster.hp, 0);
  } finally { e.bridge.dispose(); t.mock.timers.reset(); }
});

test("morte por golpe gera uma mensagem monsterDied, um corpse e XP único", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const a = create();
  a.monster.hp = 1;
  const e = eventsFor(a.world);
  try {
    const xpBefore = a.player.experience;
    assert.equal(CombatSystem.attack(a.player, a.monster, a.world), 1);
    assert.equal(e.damage.length, 1);
    assert.equal(e.messages.length, 1);
    assert.deepEqual(e.messages[0], {
      playerId: a.player.id,
      message: { type: "monsterDied", monsterId: a.monster.id },
    });
    assert.equal(a.world.corpses.length, 1);
    assert.equal(a.player.experience - xpBefore, 4);
    assert.equal(CombatSystem.attack(a.player, a.monster, a.world), 0);
    assert.equal(e.messages.length, 1);
    assert.equal(a.world.corpses.length, 1);
  } finally { e.bridge.dispose(); t.mock.timers.reset(); }
});

test("morte de monstro por outro monstro não manda monsterDied ao jogador", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const a = create();
  a.monster.hp = 1;
  const second = new Monster("monster-2", monsterType, 2, 3, new MonsterAI());
  second.attack = 20;
  a.world.addMonster(second);
  const e = eventsFor(a.world);
  try {
    CombatSystem.attack(second, a.monster, a.world);
    assert.equal(e.messages.length, 0);
    assert.equal(a.world.corpses.length, 1);
  } finally { e.bridge.dispose(); t.mock.timers.reset(); }
});

test("eventos de morte de outro mundo não entregam monsterDied a este", () => {
  const a = create();
  const e = eventsFor(a.world);
  try {
    EventSystem.getInstance().emit<MonsterDeathEventData>(GameEvent.MONSTER_DEATH, {
      monsterId: "other", monsterName: "Other",
      killerId: a.player.id, killerName: a.player.name,
      position: { x: 2, y: 2 },
      world: new World(),
    });
    assert.equal(e.messages.length, 0);
  } finally { e.bridge.dispose(); }
});

test("ataque manual não usa broadcast direto nem sendDamage adicional", async () => {
  const a = create();
  const e = eventsFor(a.world);
  const { context, failures, stats } = ctx(a.world);
  try {
    await handleAttack({} as WebSocket, a.player,
      { type: "attack", targetId: a.monster.id }, context);
    assert.deepEqual(failures, []);
    assert.deepEqual(stats, []);
    assert.equal(e.damage.length, 1);
  } finally { e.bridge.dispose(); }
});

test("ataque manual fora do alcance é recusado sem gastar cooldown", async () => {
  const a = create();
  const { context, failures } = ctx(a.world);
  a.monster.position = { x: 9, y: 9 };
  await handleAttack({} as WebSocket, a.player,
    { type: "attack", targetId: a.monster.id }, context);
  assert.deepEqual(failures, ["Alvo muito longe"]);
  a.monster.position = { x: 3, y: 2 };
  assert.equal(PlayerAttackSystem.tryAttack(a.player, a.monster, a.world).ok, true);
});

test("ataque manual e automático compartilham cooldown de 1000ms", () => {
  const a = create();
  assert.equal(PLAYER_ATTACK_COOLDOWN_MS, 1000);
  const first = PlayerAttackSystem.tryAttack(a.player, a.monster, a.world);
  assert.equal(first.ok, true);
  const second = PlayerAttackSystem.tryAttack(a.player, a.monster, a.world);
  assert.deepEqual(second, { ok: false, reason: "Ataque em cooldown" });
  a.player.cooldownManager.removeCooldown("attack");
  assert.equal(PlayerAttackSystem.tryAttack(a.player, a.monster, a.world).ok, true);
});

test("personagem morto e alvo ausente não podem iniciar ataques", () => {
  const a = create();
  a.player.hp = 0;
  assert.deepEqual(PlayerAttackSystem.tryAttack(a.player, a.monster, a.world),
    { ok: false, reason: "Atacante morto" });
  a.player.hp = a.player.maxHp;
  assert.deepEqual(PlayerAttackSystem.tryAttack(a.player, undefined, a.world),
    { ok: false, reason: "Alvo não encontrado" });
});

test("auto attack só escolhe alvo válido e não consome cooldown na seleção", () => {
  const a = create();
  const { context, failures, stats } = ctx(a.world);
  handleStartAutoAttack({} as WebSocket, a.player,
    { type: "startAutoAttack", targetId: a.monster.id }, context);
  assert.equal(a.player.currentTargetId, a.monster.id);
  assert.deepEqual(stats[0], ["autoAttackStarted", a.monster.id]);
  assert.deepEqual(failures, []);
  assert.equal(a.player.cooldownManager.isReady("attack"), true);
});

test("auto attack distante ou com alvo morto é recusado", () => {
  const a = create();
  const { context, failures } = ctx(a.world);
  a.monster.position = { x: 9, y: 9 };
  handleStartAutoAttack({} as WebSocket, a.player,
    { type: "startAutoAttack", targetId: a.monster.id }, context);
  assert.equal(a.player.currentTargetId, undefined);
  assert.deepEqual(failures, ["Alvo muito longe"]);
  a.monster.position = { x: 3, y: 2 };
  a.monster.hp = 0;
  handleStartAutoAttack({} as WebSocket, a.player,
    { type: "startAutoAttack", targetId: a.monster.id }, context);
  assert.deepEqual(failures, ["Alvo muito longe", "Alvo já está morto"]);
});
