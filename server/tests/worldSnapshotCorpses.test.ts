import assert from "node:assert/strict";
import { test } from "node:test";
import type { WebSocket } from "ws";
import { World } from "../src/game/world/World";
import { Corpse } from "../src/game/entities/corpse";
import { Player } from "../src/game/entities/player";
import { WorldStateSender } from "../src/network/senders/worldStateSender";
import { BroadcastService } from "../src/network/websocket/wsBroadcast";

test("initial snapshot contains corpses that existed before a new client joined", () => {
  const world = new World();
  world.generateMap(10, 10);
  const corpse = new Corpse("corpse-1", 2, 3, [], "player-1");
  world.addCorpse(corpse);
  const messages: Array<Record<string, unknown>> = [];
  const socket = {
    readyState: 1,
    send(raw: string) { messages.push(JSON.parse(raw)); },
  } as unknown as WebSocket;
  new WorldStateSender(socket).sendWorldState(world);
  assert.deepEqual(messages, [{ type: "spawn", id: corpse.id, name: "Corpse", x: 2, y: 3 }]);
});

test("snapshot corpse packet is identical to existing corpse broadcast wire format", () => {
  const world = new World();
  world.generateMap(10, 10);
  const player = new Player("player-1", "Tester", 1, 1);
  world.addPlayer(player);
  const corpse = new Corpse("corpse-2", 4, 4, [], player.id);
  world.addCorpse(corpse);
  const messages: Array<Record<string, unknown>> = [];
  const socket = {
    readyState: 1,
    send(raw: string) { messages.push(JSON.parse(raw)); },
  } as unknown as WebSocket;
  const broadcast = new BroadcastService(world);
  broadcast.registerClient(socket, player);
  new WorldStateSender(socket).sendWorldState(world);
  const snapshot = messages[0];
  messages.length = 0;
  broadcast.broadcastSpawnCorpse(corpse);
  assert.deepEqual(messages, [snapshot]);
  broadcast.unregisterClient(socket);
});
