import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { WebSocket } from "ws";
import { Player } from "../src/game/entities/player";
import { World } from "../src/game/world/World";
import { FishingSystem } from "../src/game/systems/fishingSystem";
import { DeathSystem } from "../src/game/systems/deathSystem";
import { ItemRegistry } from "../src/data/items/itemRegistry";
import { SkillType } from "../src/shared/enums/skillType.enum";
import { WebSocketServer } from "../src/network/websocket/wsServer";

const rodId = "fishing/rods/basic_rod";

function fixture(t: import("node:test").TestContext) {
  const world = new World();
  world.generateMap(12, 12);
  const player = new Player("angler", "Angler", 3, 8);
  player.inventory.set(rodId, 1);
  world.addPlayer(player);
  t.mock.method(ItemRegistry, "get", (id: string) => {
    if (id === rodId) return {
      id, name: "Test Rod", type: "fishing", fishingTime: 100,
      fishingBonus: 0,
    } as ReturnType<typeof ItemRegistry.get>;
    throw new Error("Unexpected ItemRegistry.get: " + id);
  });
  return { world, player };
}

test("pesca cancelada antes do timeout não concede item, gold ou skill", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { player } = fixture(t);
  const skill = player.skills.get(SkillType.FISHING)!;
  const before = { gold: player.gold, progress: skill.progress };
  assert.equal(FishingSystem.startFishing(player, new World()), true);
  assert.equal(player.isFishing, true);
  FishingSystem.cancelFishing(player);
  t.mock.timers.tick(200);
  assert.equal(player.isFishing, false);
  assert.equal(player.fishingTimer, undefined);
  assert.equal(player.gold, before.gold);
  assert.equal(player.skills.get(SkillType.FISHING)!.progress, before.progress);
  assert.deepEqual([...player.inventory], [[rodId, 1]]);
});

test("morte encerra pesca e timeout não entrega recompensa após o respawn", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { world, player } = fixture(t);
  const beforeSkill = player.skills.get(SkillType.FISHING)!.progress;
  assert.equal(FishingSystem.startFishing(player, world), true);
  player.hp = 0;
  DeathSystem.handleDeath(player, undefined, world);
  assert.equal(player.hp, player.maxHp);
  assert.equal(player.isFishing, false);
  t.mock.timers.tick(200);
  assert.equal(player.skills.get(SkillType.FISHING)!.progress, beforeSkill);
  assert.deepEqual([...player.inventory], [[rodId, 1]]);
  DeathSystem.cancelPendingTimers(world);
});

test("desconexão WebSocket encerra pesca sem reiniciar o servidor", async (t) => {
  const { world, player } = fixture(t);
  const server = createServer();
  const transport = new WebSocketServer(server, world, { authRequired: false });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const client = new WebSocket(`ws://127.0.0.1:${port}`);
  try {
    await once(client, "open");
    assert.equal(FishingSystem.startFishing(player, world), true);
    assert.equal(player.isFishing, true);
    const closed = once(client, "close");
    client.close();
    await closed;
    // Fechamento do cliente e limpeza do servidor são eventos distintos.
    const deadline = Date.now() + 1000;
    while (player.isFishing && Date.now() < deadline) {
      await new Promise<void>(resolve => setTimeout(resolve, 10));
    }
    assert.equal(player.isFishing, false);
    assert.equal(player.fishingTimer, undefined);
    await new Promise<void>(resolve => setTimeout(resolve, 140));
    assert.deepEqual([...player.inventory], [[rodId, 1]]);
    assert.equal(player.skills.get(SkillType.FISHING)!.progress, 0);
  } finally {
    FishingSystem.cancelFishing(player);
    if (client.readyState !== WebSocket.CLOSED) client.terminate();
    await transport.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
