import assert from "node:assert/strict";
import { test } from "node:test";
import { Player } from "../src/game/entities/player";
import { ExperienceSystem as XP } from "../src/game/systems/experienceSystem";
import { EventSystem } from "../src/game/core/events/eventSystem";
import { GameEvent } from "../src/shared/enums/gameEvent.enum";
import type { PlayerLevelUpEventData, PlayerGainXpEventData } from "../src/shared/interfaces/eventData.interface";
import { Vocation } from "../src/shared/enums/vocation.enum";
import { PlayerStatsSender } from "../src/network/senders/playerStatsSender";

const createPlayer = () => new Player("player-test", "Tester", 2, 2);

test("curva cumulativa começa com 0 XP e o level 2 exige 100", () => {
  assert.equal(XP.getTotalXpForLevel(1), 0);
  assert.equal(XP.getTotalXpForLevel(2), 100);
  assert.equal(XP.getTotalXpForLevel(3), 230);
  assert.equal(XP.getTotalXpForLevel(3500), 237490255);
  assert.equal(XP.MAX_LEVEL, 5000);
});

test("subir do level 1 para 2 mantém os 100 XP, sem descontar", () => {
  const player = createPlayer();
  assert.equal(XP.addXp(player, 100), true);
  assert.equal(player.level, 2);
  assert.equal(player.experience, 100);
  assert.equal(player.lifetimeExperience, 100);
  assert.equal(player.experienceToNext, 230);
});

test("250 XP mantém 250 XP total e sobe para o level 3", () => {
  const player = createPlayer();
  XP.addXp(player, 250);
  assert.equal(player.level, 3);
  assert.equal(player.experience, 250);
  assert.equal(player.xp, 250); // alias antigo de Creature
  assert.equal(XP.getLevelProgress(player), 20);
  assert.equal(XP.getLevelRequirement(player.level), 160); // 390 - 230
});

test("player.addExperience delega para a mesma regra cumulativa", () => {
  const player = createPlayer();
  player.addExperience(250);
  player.addExperience(140);
  assert.equal(player.level, 4);
  assert.equal(player.experience, 390);
  assert.equal(player.lifetimeExperience, 390);
});

test("acumular várias recompensas pequenas concede o nível no momento correto", () => {
  const player = createPlayer();
  for (let i = 0; i < 24; i++) XP.addXp(player, 4);
  assert.equal(player.level, 1);
  XP.addXp(player, 4);
  assert.equal(player.level, 2);
  assert.equal(player.experience, 100);
});

test("ganho muito alto pode subir vários níveis sem perder XP", () => {
  const player = createPlayer();
  XP.addXp(player, XP.getTotalXpForLevel(10) + 7);
  assert.equal(player.level, 10);
  assert.equal(player.experience, XP.getTotalXpForLevel(10) + 7);
  assert.equal(player.lifetimeExperience, player.experience);
});

test("level up respeita HP máximo por vocação", () => {
  const player = createPlayer();
  player.vocation = Vocation.KNIGHT;
  player.recalculateStats();
  player.hp = 10;
  XP.addXp(player, 250);
  assert.equal(player.maxHp, 180);
  assert.equal(player.hp, player.maxHp);
});

test("XP inválido não modifica o personagem", () => {
  const player = createPlayer();
  for (const amount of [0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(XP.addXp(player, amount), false);
    assert.equal(player.experience, 0);
    assert.equal(player.lifetimeExperience, 0);
  }
});

test("nível máximo é 5000 e o XP fica limitado ao topo da curva", () => {
  const player = createPlayer();
  player.level = 4999;
  player.experience = XP.getTotalXpForLevel(4999);
  player.lifetimeExperience = player.experience;
  const top = XP.getTotalXpForLevel(XP.MAX_LEVEL);
  assert.equal(XP.addXp(player, 1000000000), true);
  assert.equal(player.level, XP.MAX_LEVEL);
  assert.equal(player.experience, top);
  assert.equal(player.experienceToNext, top);
  assert.equal(XP.addXp(player, 4), false);
});

test("morte perde somente 10% do progresso do nível e preserva o histórico", () => {
  const player = createPlayer();
  XP.addXp(player, 260); // nível 3: começa em 230 XP, progresso 30
  assert.equal(XP.applyDeathPenalty(player), 3);
  assert.equal(player.experience, 257);
  assert.equal(player.lifetimeExperience, 260);
  assert.equal(player.level, 3);
});

test("save legado converte o percentual de progresso sem perder o nível", () => {
  assert.equal(XP.migrateLegacyXp(2, 50), 165);
  assert.equal(XP.migrateLegacyXp(1, 0), 0);
});

test("eventos informam os níveis reais e o XP cumulativo", () => {
  const player = createPlayer();
  const events = EventSystem.getInstance();
  const levels: Array<[number, number]> = [];
  const gained: number[] = [];
  const onLevel = (e: PlayerLevelUpEventData) => levels.push([e.oldLevel, e.newLevel]);
  const onXp = (e: PlayerGainXpEventData) => gained.push(e.newTotalXp);
  events.on(GameEvent.PLAYER_LEVEL_UP, onLevel);
  events.on(GameEvent.PLAYER_GAIN_XP, onXp);
  try {
    XP.addXp(player, 250);
    assert.deepEqual(levels, [[1, 2], [2, 3]]);
    assert.deepEqual(gained, [250]);
  } finally {
    events.off(GameEvent.PLAYER_LEVEL_UP, onLevel);
    events.off(GameEvent.PLAYER_GAIN_XP, onXp);
  }
});

test("playerStats contém XP total, histórico e barra correta, sem alterar HP", () => {
  const player = createPlayer();
  XP.addXp(player, 250);
  player.hp = 20;
  const payload = PlayerStatsSender.toPayload(player);
  assert.equal(payload.type, "playerStats");
  assert.equal(payload.xp, 250);
  assert.equal(payload.xpToNext, 390);
  assert.equal(payload.levelXp, 20);
  assert.equal(payload.levelXpToNext, 160);
  assert.equal(payload.lifetimeXp, 250);
  assert.equal(player.hp, 20);
  assert.equal(payload.hp, 20);
});
