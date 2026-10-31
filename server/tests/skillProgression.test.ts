/** Skill progression preserves fractional Fishing gains and rejects corrupt state. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { Player } from "../src/game/entities/player";
import { SkillSystem } from "../src/game/systems/skillSystem";
import { SkillType } from "../src/shared/enums/skillType.enum";
import { EventSystem } from "../src/game/core/events/eventSystem";
import type { SkillLevelUpEventData } from "../src/shared/interfaces/skill.interface";

test("skill progress rejects negative, NaN, Infinity and zero without mutation", () => {
  const player = new Player("skill-invalid", "Invalid", 2, 2);
  const before = { ...player.skills.get(SkillType.SWORD)! };
  for (const invalid of [-10, -0.1, 0, Number.NaN, Infinity, -Infinity]) {
    SkillSystem.addProgress(player, SkillType.SWORD, invalid);
    assert.deepEqual(player.skills.get(SkillType.SWORD), before);
  }
});

test("Fishing accepts fractional skill progress and preserves the remainder", () => {
  const player = new Player("skill-fishing", "Angler", 2, 2);
  player.skills.set(SkillType.FISHING, { level: 1, progress: 99.75 });
  SkillSystem.addProgress(player, SkillType.FISHING, 0.5);
  assert.deepEqual(player.skills.get(SkillType.FISHING), { level: 2, progress: 0.25 });
});

test("multiple skill levels update once and the event reports actual original level", () => {
  const player = new Player("skill-many", "Trainee", 2, 2);
  const oldLevel = 8;
  player.skills.set(SkillType.SWORD, { level: oldLevel, progress: 60 });
  const events: SkillLevelUpEventData[] = [];
  const onLevelUp = (data: SkillLevelUpEventData) => events.push(data);
  EventSystem.getInstance().on("skill:levelUp", onLevelUp);
  try {
    SkillSystem.addProgress(player, SkillType.SWORD, 250);
    assert.deepEqual(player.skills.get(SkillType.SWORD), { level: 11, progress: 10 });
    assert.equal(events.length, 1);
    assert.equal(events[0].oldLevel, oldLevel);
    assert.equal(events[0].newLevel, 11);
    assert.equal(events[0].newProgress, 10);
  } finally {
    EventSystem.getInstance().off("skill:levelUp", onLevelUp);
  }
});

test("overflow or previously invalid skill state is never persisted", () => {
  const player = new Player("skill-overflow", "Trainee", 2, 2);
  player.skills.set(SkillType.SWORD, { level: 1, progress: 50 });
  SkillSystem.addProgress(player, SkillType.SWORD, Number.MAX_VALUE);
  assert.deepEqual(player.skills.get(SkillType.SWORD), { level: 1, progress: 50 });

  player.skills.set(SkillType.SWORD, { level: 3, progress: Number.NaN });
  SkillSystem.addProgress(player, SkillType.SWORD, 10);
  assert.ok(Number.isNaN(player.skills.get(SkillType.SWORD)?.progress));

  player.skills.set(SkillType.SWORD, { level: 4, progress: 99 });
  SkillSystem.addProgress(player, SkillType.SWORD, 900_000);
  assert.deepEqual(player.skills.get(SkillType.SWORD), { level: 9005, progress: 99 });
});
