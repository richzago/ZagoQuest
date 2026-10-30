import assert from "node:assert/strict";
import { test } from "node:test";
import { Player } from "../src/game/entities/player";
import { ExperienceSystem } from "../src/game/systems/experienceSystem";
import { EventSystem } from "../src/game/core/events/eventSystem";
import { GameEvent } from "../src/shared/enums/gameEvent.enum";
import type { PlayerLevelUpEventData, PlayerGainXpEventData } from "../src/shared/interfaces/eventData.interface";
import { Vocation } from "../src/shared/enums/vocation.enum";
import { PlayerStatsSender } from "../src/network/senders/playerStatsSender";

const createPlayer = () => new Player("player-test", "Tester", 2, 2);

test("ganhar XP abaixo do requisito preserva o nível", () => {
  const player = createPlayer();
  assert.equal(ExperienceSystem.addXp(player, 50), false);
  assert.equal(player.level, 1);
  assert.equal(player.experience, 50);
  assert.equal(player.experienceToNext, 100);
});

test("ganhar exatamente 100 XP sobe um nível e zera o progresso", () => {
  const player = createPlayer();
  assert.equal(ExperienceSystem.addXp(player, 100), true);
  assert.equal(player.level, 2);
  assert.equal(player.experience, 0);
  assert.equal(player.experienceToNext, ExperienceSystem.getRequiredXp(2));
});

test("250 XP sobem apenas dois níveis, consumindo XP em cada passagem", () => {
  const player = createPlayer();
  ExperienceSystem.addXp(player, 250);
  assert.equal(player.level, 3);
  assert.equal(player.experience, 50);
  assert.equal(player.xp, player.experience); // alias legado de Creature
});

test("player.addExperience usa a mesma regra de progressão", () => {
  const player = createPlayer();
  player.addExperience(250);
  assert.equal(player.level, 3);
  assert.equal(player.experience, 50);
  player.addExperience(50);
  assert.equal(player.level, 4);
  assert.equal(player.experience, 0);
});

test("progressão em múltiplos níveis usa a curva real de XP", () => {
  const player = createPlayer();
  const required = [1, 2, 3, 4].reduce(
    (sum, level) => sum + ExperienceSystem.getRequiredXp(level), 0
  );
  ExperienceSystem.addXp(player, required + 11);
  assert.equal(player.level, 5);
  assert.equal(player.experience, 11);
  assert.equal(player.experienceToNext, ExperienceSystem.getRequiredXp(5));
});

test("level up recalcula atributos por vocação e restaura HP", () => {
  const player = createPlayer();
  player.vocation = Vocation.KNIGHT;
  player.recalculateStats();
  player.hp = 10;
  ExperienceSystem.addXp(player, 250);
  assert.equal(player.maxHp, 180); // 150 HP base + 2 níveis x 15
  assert.equal(player.hp, player.maxHp);
});

test("XP inválido não modifica o personagem", () => {
  const player = createPlayer();
  const invalid = [0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1];
  for (const amount of invalid) {
    assert.equal(ExperienceSystem.addXp(player, amount), false);
    assert.equal(player.experience, 0);
    assert.equal(player.level, 1);
  }
});

test("limite de nível 100 descarta excedente e bloqueia novas recompensas", () => {
  const player = createPlayer();
  player.level = 99;
  player.recalculateStats();
  const required = ExperienceSystem.getRequiredXp(99);
  assert.equal(ExperienceSystem.addXp(player, required + 500), true);
  assert.equal(player.level, 100);
  assert.equal(player.experience, 0);
  assert.equal(player.experienceToNext, 0);
  assert.equal(ExperienceSystem.addXp(player, 1000), false);
  assert.equal(player.level, 100);
  assert.equal(player.experience, 0);
});

test("um evento de level-up por nível e evento XP informa saldo correto", () => {
  const player = createPlayer();
  const events = EventSystem.getInstance();
  const levels: Array<[number, number]> = [];
  const balances: number[] = [];
  const onLevel = (e: PlayerLevelUpEventData) => levels.push([e.oldLevel, e.newLevel]);
  const onXp = (e: PlayerGainXpEventData) => balances.push(e.currentLevelXp);
  events.on(GameEvent.PLAYER_LEVEL_UP, onLevel);
  events.on(GameEvent.PLAYER_GAIN_XP, onXp);
  try {
    ExperienceSystem.addXp(player, 250);
    assert.deepEqual(levels, [[1, 2], [2, 3]]);
    assert.deepEqual(balances, [50]);
  } finally {
    events.off(GameEvent.PLAYER_LEVEL_UP, onLevel);
    events.off(GameEvent.PLAYER_GAIN_XP, onXp);
  }
});

test("payload de stats usa xp/xpToNext e não modifica estado", () => {
  const player = createPlayer();
  ExperienceSystem.addXp(player, 50);
  player.hp = 20;
  const payload = PlayerStatsSender.toPayload(player);
  assert.equal(payload.type, "playerStats");
  assert.equal(payload.xp, 50);
  assert.equal(payload.xpToNext, 100);
  assert.equal(player.hp, 20);
  assert.equal(payload.hp, 20);
});
