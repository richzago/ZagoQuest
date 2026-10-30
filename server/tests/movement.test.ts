/**
 * Movimento autoritativo: testes sem rede, banco ou Unity.
 * O relógio é passado diretamente ao MovementSystem para testar cooldowns.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { WebSocket } from "ws";
import { Player } from "../src/game/entities/player";
import { Monster } from "../src/game/entities/monster";
import { Npc } from "../src/game/entities/npc";
import { MonsterAI } from "../src/game/ai/monsterAi";
import { World } from "../src/game/world/World";
import {
  MovementSystem,
  MIN_MOVE_INTERVAL_MS,
} from "../src/game/systems/movementSystem";
import { handleMove, handleMoveDir } from "../src/network/handlers/move.handler";
import type { HandlerContext } from "../src/network/handlers/HandlerContext";
import { ChatSystem } from "../src/game/chat/chatSystem";
import type { MonsterType } from "../src/shared/interfaces/monster.interface";

const player = () => new Player("player-test", "Tester", 2, 2);
const world = () => {
  const instance = new World();
  instance.generateMap(10, 10); // Parede padrão em (5,5)
  return instance;
};
const monsterType: MonsterType = {
  id: "monster-test",
  name: "Test Monster",
  stats: { hp: 10 },
  combat: { xp: 1, damageMin: 1, damageMax: 2 },
  ai: { type: "passive" },
  visual: { symbol: "M" },
};
const monsterAt = (x: number, y: number) =>
  new Monster("monster-test", monsterType, x, y, new MonsterAI());

function context(gameWorld: World) {
  const positions: Array<[number, number]> = [];
  const broadcasts: Array<{ id: string; x: number; y: number; except?: WebSocket }> = [];
  const ctx = {
    world: gameWorld,
    packetSender: { combat: {
      sendPosition: (x: number, y: number) => positions.push([x, y]),
    } },
    broadcast: {
      broadcastMove: (id: string, x: number, y: number, except?: WebSocket) =>
        broadcasts.push({ id, x, y, except }),
    },
  } as unknown as HandlerContext;
  return { ctx, positions, broadcasts };
}
const socket = {} as WebSocket;

test("um passo cardinal é aceito e atualiza a posição no servidor", () => {
  const p = player();
  assert.equal(MovementSystem.moveTo(p, world(), 3, 2, 1000), "moved");
  assert.deepEqual(p.position, { x: 3, y: 2 });
});

test("todos os oito comandos direcionais percorrem só um tile", () => {
  const directions = {
    north: [0, 1], south: [0, -1], east: [1, 0], west: [-1, 0],
    northeast: [1, 1], northwest: [-1, 1],
    southeast: [1, -1], southwest: [-1, -1],
  } as const;
  for (const [dir, [dx, dy]] of Object.entries(directions)) {
    const p = player();
    assert.equal(MovementSystem.moveDirection(p, world(), dir, 1000), "moved");
    assert.deepEqual(p.position, { x: 2 + dx, y: 2 + dy });
  }
});

test("coordenadas absolutas não permitem teleportar para destino livre", () => {
  const p = player();
  const gameWorld = world();
  for (const [x, y] of [[8, 8], [2, 8], [5, 2], [9, 9], [-2, -2]]) {
    assert.equal(MovementSystem.moveTo(p, gameWorld, x, y, 1000), "invalid");
    assert.deepEqual(p.position, { x: 2, y: 2 });
  }
});

test("coordenadas no mesmo tile não são um passo válido", () => {
  const p = player();
  assert.equal(MovementSystem.moveTo(p, world(), 2, 2, 1000), "invalid");
  assert.deepEqual(p.position, { x: 2, y: 2 });
});

test("rejeita NaN, Infinity, strings, decimais, nulos e objetos", () => {
  const p = player();
  const gameWorld = world();
  for (const bad of [NaN, Infinity, -Infinity, 2.5, "3", null, undefined, {}, [], true]) {
    assert.equal(MovementSystem.moveTo(p, gameWorld, bad, 2, 1000), "invalid");
    assert.equal(MovementSystem.moveTo(p, gameWorld, 2, bad, 1000), "invalid");
  }
  assert.deepEqual(p.position, { x: 2, y: 2 });
});

test("não movimenta um personagem já morto", () => {
  const p = player();
  p.hp = 0;
  assert.equal(MovementSystem.moveTo(p, world(), 3, 2, 1000), "invalid");
  assert.deepEqual(p.position, { x: 2, y: 2 });
});

test("uma posição de origem corrompida não libera movimento", () => {
  const p = player();
  p.position.x = NaN;
  assert.equal(MovementSystem.moveTo(p, world(), 3, 2, 1000), "invalid");
});

test("parede e limite de mapa impedem qualquer movimento", () => {
  const p = player();
  const gameWorld = world();
  p.position = { x: 4, y: 5 };
  assert.equal(MovementSystem.moveTo(p, gameWorld, 5, 5, 1000), "blocked");
  assert.deepEqual(p.position, { x: 4, y: 5 });
  p.position = { x: 0, y: 0 };
  assert.equal(MovementSystem.moveTo(p, gameWorld, -1, 0, 1000), "blocked");
});

test("outros jogadores, NPCs e monstros vivos bloqueiam o tile", () => {
  const actors = [
    (w: World) => w.addPlayer(new Player("other", "Other", 3, 2)),
    (w: World) => w.addNpc(new Npc("npc", "NPC", 3, 2, "Oi")),
    (w: World) => w.addMonster(monsterAt(3, 2)),
  ];
  for (const addActor of actors) {
    const gameWorld = world();
    addActor(gameWorld);
    const p = player();
    assert.equal(MovementSystem.moveTo(p, gameWorld, 3, 2, 1000), "blocked");
    assert.deepEqual(p.position, { x: 2, y: 2 });
  }
});

test("monstro morto não bloqueia a passagem até ser removido pelo cleanup", () => {
  const gameWorld = world();
  const p = player();
  const monster = monsterAt(3, 2);
  monster.hp = 0;
  gameWorld.addMonster(monster);
  assert.equal(MovementSystem.moveTo(p, gameWorld, 3, 2, 1000), "moved");
});

test("diagonal não atravessa canto bloqueado no eixo X", () => {
  const gameWorld = world();
  const p = player();
  gameWorld.getTile(3, 2)!.walkable = false;
  assert.equal(MovementSystem.moveDirection(p, gameWorld, "northeast", 1000), "blocked");
  assert.deepEqual(p.position, { x: 2, y: 2 });
});

test("diagonal não atravessa canto bloqueado no eixo Y", () => {
  const gameWorld = world();
  const p = player();
  gameWorld.getTile(2, 3)!.walkable = false;
  assert.equal(MovementSystem.moveTo(p, gameWorld, 3, 3, 1000), "blocked");
});

test("diagonal também respeita bloqueios por entidades nos tiles laterais", () => {
  const gameWorld = world();
  const p = player();
  gameWorld.addMonster(monsterAt(3, 2));
  assert.equal(MovementSystem.moveDirection(p, gameWorld, "northeast", 1000), "blocked");
});

test("diagonal livre funciona normalmente", () => {
  const p = player();
  assert.equal(MovementSystem.moveTo(p, world(), 3, 3, 1000), "moved");
  assert.deepEqual(p.position, { x: 3, y: 3 });
});

test("direção arbitrária ou propriedade herdada do JS nunca é aceita", () => {
  const p = player();
  for (const bad of ["", "northwest2", "constructor", "__proto__", "toString", null, 1, {}]) {
    assert.equal(MovementSystem.moveDirection(p, world(), bad, 1000), "invalid");
  }
  assert.deepEqual(p.position, { x: 2, y: 2 });
});

test("intervalo de 150 ms entre passos aceitos impede corrida de pacotes", () => {
  const p = player();
  const gameWorld = world();
  assert.equal(MIN_MOVE_INTERVAL_MS, 150);
  assert.equal(MovementSystem.moveTo(p, gameWorld, 3, 2, 1000), "moved");
  assert.equal(MovementSystem.moveTo(p, gameWorld, 4, 2, 1149), "cooldown");
  assert.deepEqual(p.position, { x: 3, y: 2 });
  assert.equal(MovementSystem.moveTo(p, gameWorld, 4, 2, 1150), "moved");
});

test("alternar move e moveDir não contorna o cooldown", () => {
  const p = player();
  const gameWorld = world();
  assert.equal(MovementSystem.moveDirection(p, gameWorld, "east", 1000), "moved");
  assert.equal(MovementSystem.moveTo(p, gameWorld, 4, 2, 1010), "cooldown");
  assert.equal(MovementSystem.moveDirection(p, gameWorld, "east", 1150), "moved");
});

test("pedidos rejeitados não gastam o cooldown", () => {
  const p = player();
  const gameWorld = world();
  assert.equal(MovementSystem.moveTo(p, gameWorld, 8, 8, 1000), "invalid");
  assert.equal(MovementSystem.moveTo(p, gameWorld, 3, 2, 1000), "moved");
});

test("relógio não finito não permite mover", () => {
  const p = player();
  assert.equal(MovementSystem.moveTo(p, world(), 3, 2, NaN), "invalid");
  assert.deepEqual(p.position, { x: 2, y: 2 });
});

test("handler move confirma posição real quando cliente tenta teleportar", async () => {
  const p = player();
  const { ctx, positions, broadcasts } = context(world());
  await handleMove(socket, p, { type: "move", x: 8, y: 8 }, ctx);
  assert.deepEqual(positions, [[2, 2]]);
  assert.equal(broadcasts.length, 0);
  assert.deepEqual(p.position, { x: 2, y: 2 });
});

test("handler moveDir confirma e transmite somente o passo aceito", async () => {
  const p = player();
  const { ctx, positions, broadcasts } = context(world());
  await handleMoveDir(socket, p, { type: "moveDir", dir: "east" }, ctx);
  assert.deepEqual(positions, [[3, 2]]);
  assert.deepEqual(broadcasts, [{ id: p.id, x: 3, y: 2, except: socket }]);
});

test("handler moveDir inválido devolve a posição real sem broadcast", async () => {
  const p = player();
  const { ctx, positions, broadcasts } = context(world());
  await handleMoveDir(socket, p, { type: "moveDir", dir: "__proto__" as any }, ctx);
  assert.deepEqual(positions, [[2, 2]]);
  assert.equal(broadcasts.length, 0);
});

test("handler move sincroniza posição nos outros jogadores apenas após sucesso", async () => {
  const p = player();
  const { ctx, positions, broadcasts } = context(world());
  await handleMove(socket, p, { type: "move", x: 3, y: 2 }, ctx);
  assert.deepEqual(positions, [[3, 2]]);
  assert.deepEqual(broadcasts, [{ id: p.id, x: 3, y: 2, except: socket }]);
});

test("afastar-se de NPC com WASD encerra conversa (antes só ocorria em move)", async (t) => {
  t.mock.method(ChatSystem, "sendPrivateMessage", () => {});
  const gameWorld = world();
  const p = player();
  const npc = new Npc("npc", "Vendedor", 0, 2, "Olá");
  npc.isTalking = true;
  npc.talkingToPlayerId = p.id;
  gameWorld.addNpc(npc);
  const { ctx } = context(gameWorld);

  await handleMoveDir(socket, p, { type: "moveDir", dir: "east" }, ctx);
  assert.equal(npc.isTalking, false);
  assert.equal(npc.talkingToPlayerId, undefined);
});

test("movimento recusado não encerra conversa com NPC", async (t) => {
  t.mock.method(ChatSystem, "sendPrivateMessage", () => {});
  const gameWorld = world();
  const p = player();
  const npc = new Npc("npc", "Vendedor", 0, 2, "Olá");
  npc.isTalking = true;
  npc.talkingToPlayerId = p.id;
  gameWorld.addNpc(npc);
  const { ctx } = context(gameWorld);

  await handleMove(socket, p, { type: "move", x: 9, y: 9 }, ctx);
  assert.equal(npc.isTalking, true);
  assert.equal(npc.talkingToPlayerId, p.id);
});

test("movimento aceito cancela pesca, rejeitado mantém pesca", async () => {
  const p = player();
  const gameWorld = world();
  const { ctx } = context(gameWorld);
  p.isFishing = true;
  p.fishingTimer = setTimeout(() => {}, 60_000);

  try {
    await handleMove(socket, p, { type: "move", x: 8, y: 8 }, ctx);
    assert.equal(p.isFishing, true);
    await handleMoveDir(socket, p, { type: "moveDir", dir: "east" }, ctx);
    assert.equal(p.isFishing, false);
    assert.equal(p.fishingTimer, undefined);
  } finally {
    if (p.fishingTimer) clearTimeout(p.fishingTimer);
  }
});
