/** Regression: use actual ItemRegistry bait ids rather than singular legacy prefix. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { Player } from "../src/game/entities/player";
import { World } from "../src/game/world/World";
import { FishingSystem } from "../src/game/systems/fishingSystem";
import { ItemRegistry } from "../src/data/items/itemRegistry";
import { EquipmentSlot } from "../src/shared/enums/equipmentSlot.enum";

test("pesca consome uma isca real de fishing/baits sem tocar no estoque da vara", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const player = new Player("bait-player", "Angler", 2, 8);
  const world = new World();
  world.generateMap(12, 12);
  const rod = "fishing/rods/basic_rod";
  const bait = "fishing/baits/worm";
  player.equipment.set(EquipmentSlot.WEAPON, rod);
  player.equipment.set(EquipmentSlot.USEFUL, bait);
  player.inventory.set(bait, 3);
  world.getTile(3, 8)!.isWater = true;
  t.mock.method(ItemRegistry, "get", (id: string) => {
    if (id === rod) return {
      id, name: "Basic Rod", type:"equipment",slot:EquipmentSlot.WEAPON,
      fishingTime: 1000, fishingBonus: 0.05,
    } as ReturnType<typeof ItemRegistry.get>;
    if (id === bait) return {
      id, name: "Worm", type:"equipment",slot:EquipmentSlot.USEFUL,
      fishingBonus: 0.1,
    } as ReturnType<typeof ItemRegistry.get>;
    throw new Error(`Unexpected item: ${id}`);
  });
  try {
    assert.equal(FishingSystem.startFishing(player, world), true);
    assert.equal(player.inventory.get(bait), 2);
    assert.equal(player.equipment.get(EquipmentSlot.WEAPON), rod);
    assert.equal(player.isFishing, true);
  } finally {
    FishingSystem.cancelFishing(player);
  }
});

test("C7.1: sem isca equipada em Useful não permite iniciar pesca", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const player = new Player("bait-optional", "Angler", 2, 8);
  const world = new World();
  world.generateMap(12, 12);
  const rod = "fishing/rods/basic_rod";
  player.equipment.set(EquipmentSlot.WEAPON, rod);
  world.getTile(3, 8)!.isWater = true;
  t.mock.method(ItemRegistry, "get", (id: string) => {
    assert.equal(id, rod);
    return { id, name: "Basic Rod", fishingTime: 1000 } as ReturnType<typeof ItemRegistry.get>;
  });
  try {
    assert.equal(FishingSystem.startFishing(player, world), false);
    assert.equal(player.isFishing, false);
    assert.equal(player.inventory.size, 0);
  } finally {
    FishingSystem.cancelFishing(player);
  }
});
