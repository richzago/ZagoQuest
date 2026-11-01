/**
 * Regressões para a fronteira de confiança WebSocket.
 * Sem PostgreSQL, Unity, nem timers reais: os dados abaixo simulam pacotes
 * que um cliente comum, antigo ou deliberadamente alterado poderia enviar.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseClientMessage,
  MAX_PACKET_BYTES,
  MAX_CHAT_LENGTH,
  MAX_IDENTIFIER_LENGTH,
} from "../src/network/validation/messageValidation";
import {
  MessageRateLimiter,
  OrderedMessageQueue,
  MAX_MESSAGES_PER_SECOND,
  MAX_QUEUED_MESSAGES,
} from "../src/network/validation/messageGuards";
import { handlers } from "../src/network/handlers";

// Contratos enviados pelo cliente Unity; todos devem continuar compatíveis.
const validMessages = [
  { type: "move", x: 2, y: 3 },
  { type: "moveDir", dir: "northeast" },
  { type: "attack", targetId: "monster-123" },
  { type: "startAutoAttack", targetId: "monster-123" },
  { type: "stopAutoAttack" },
  { type: "chat", message: "oi, tudo bem?" },
  { type: "loot", corpseId: "corpse-1" },
  { type: "openBag", itemId: "equipment/backpack/simple_bag" },
  { type: "closeBag" },
  { type: "dropCorpseLoot", corpseId: "corpse-1", itemIndex: 0, x: 2, y: 3 },
  { type: "takeLoot", corpseId: "corpse-1", takeAll: true },
  { type: "takeLoot", corpseId: "corpse-1", takeAll: false, itemIndex: 0 },
  { type: "useItem", itemId: "consumable/health_potion" },
  { type: "equipItem", itemId: "equipment/weapon/swords/boneSword" },
  { type: "unequipItem", slot: "helmet" },
  { type: "dropItem", itemId: "consumable/health_potion", amount: 1, x: 2, y: 3 },
  { type: "pickupItem", itemId: "uuid-ground-1" },
  { type: "openShop", npcId: "merchant-1" },
  { type: "buyItem", npcId: "merchant-1", itemId: "consumable/health_potion", amount: 3 },
  { type: "sellItem", npcId: "merchant-1", itemId: "consumable/health_potion", amount: 2 },
  { type: "startFishing" },
  { type: "cancelFishing" },
  { type: "openBank", npcId: "banker-1" },
  { type: "deposit", amount: 200 },
  { type: "withdraw", amount: 100 },
  { type: "closeShop", npcId: "merchant-1" },
  { type: "closeBank", npcId: "banker-1" },
] as const;

test("todos os 26 tipos de mensagem do cliente são aceitos com campos válidos", () => {
  for (const message of validMessages) {
    const parsed = parseClientMessage(JSON.stringify(message));
    assert.equal(parsed.ok, true, `Comando rejeitado: ${JSON.stringify(message)}`);
    if (parsed.ok) assert.equal(parsed.message.type, message.type);
  }
  assert.equal(new Set(validMessages.map((v) => v.type)).size, 26);
});

test("esquemas cobrem exatamente os tipos registrados nos handlers", () => {
  const fromSchemas = [...new Set(validMessages.map((v) => v.type))].sort();
  assert.deepEqual(Object.keys(handlers).sort(), fromSchemas);
});

test("dropItem legado continua aceitando amount omitido (handler assume 1)", () => {
  const result = parseClientMessage(JSON.stringify({
    type: "dropItem", itemId: "consumable/health_potion", x: 2, y: 3,
  }));
  assert.equal(result.ok, true);
  if (result.ok && result.message.type === "dropItem") {
    assert.equal(result.message.amount, undefined);
  }
});

test("JSON inválido é rejeitado sem lançar exceção", () => {
  for (const raw of ["", "{", "undefined", "{'type':'move'}", "null null"]) {
    assert.deepEqual(parseClientMessage(raw), { ok: false, reason: "invalid_json" });
  }
});

test("JSON válido mas não-objeto nunca passa aos handlers", () => {
  for (const value of [null, 4, "move", [], true, ["move"]]) {
    assert.deepEqual(parseClientMessage(JSON.stringify(value)), {
      ok: false, reason: "invalid_message",
    });
  }
});

test("tipo ausente, desconhecido ou herdado do protótipo não despacha código", () => {
  for (const message of [
    {}, { type: "" }, { type: "constructor" }, { type: "__proto__" },
    { type: "toString" }, { type: 5 }, { type: null },
  ]) {
    assert.equal(parseClientMessage(JSON.stringify(message)).ok, false);
  }
});

test("não aceita campos de identidade arbitrários enviados pelo cliente", () => {
  const result = parseClientMessage(JSON.stringify({
    type: "move", x: 2, y: 3, playerId: "victim",
  }));
  assert.deepEqual(result, { ok: false, reason: "invalid_message" });
});

test("movimento rejeita coordenadas malformadas", () => {
  for (const x of [0.5, "2", null, false, {}, Number.MAX_SAFE_INTEGER + 1]) {
    const packet = JSON.stringify({ type: "move", x, y: 1 });
    assert.equal(parseClientMessage(packet).ok, false, packet);
  }
});

test("moveDir rejeita direção arbitrária e aceita oito direções legais", () => {
  for (const dir of ["jump", "toString", "UP", null, 4, ""]) {
    assert.equal(parseClientMessage(JSON.stringify({ type: "moveDir", dir })).ok, false);
  }
  for (const dir of [
    "north", "south", "east", "west", "northeast",
    "northwest", "southeast", "southwest",
  ]) {
    assert.equal(parseClientMessage(JSON.stringify({ type: "moveDir", dir })).ok, true);
  }
});

test("chat vazio, não-string e excessivamente longo é rejeitado", () => {
  for (const message of ["", "    ", 99, null, "x".repeat(MAX_CHAT_LENGTH + 1)]) {
    assert.equal(parseClientMessage(JSON.stringify({ type: "chat", message })).ok, false);
  }
  assert.equal(parseClientMessage(JSON.stringify({
    type: "chat", message: "x".repeat(MAX_CHAT_LENGTH),
  })).ok, true);
});

test("identificadores não podem ser vazios nem extensos demais", () => {
  for (const targetId of ["", "  ", 33, "x".repeat(MAX_IDENTIFIER_LENGTH + 1)]) {
    assert.equal(parseClientMessage(JSON.stringify({ type: "attack", targetId })).ok, false);
  }
  assert.equal(parseClientMessage(JSON.stringify({
    type: "attack", targetId: "x".repeat(MAX_IDENTIFIER_LENGTH),
  })).ok, true);
});

test("valores inválidos de gold e compras nunca passam ao sistema econômico", () => {
  for (const amount of [0, -1, -30, 0.5, "5", null, Number.MAX_SAFE_INTEGER + 1]) {
    for (const type of ["deposit", "withdraw"]) {
      assert.equal(parseClientMessage(JSON.stringify({ type, amount })).ok, false);
    }
    assert.equal(parseClientMessage(JSON.stringify({
      type: "buyItem", npcId: "npc", itemId: "item", amount,
    })).ok, false);
  }
});

test("takeLoot individual exige itemIndex inteiro e não negativo", () => {
  for (const itemIndex of [undefined, -1, 0.5, "0", null]) {
    assert.equal(parseClientMessage(JSON.stringify({
      type: "takeLoot", corpseId: "corpse", takeAll: false, itemIndex,
    })).ok, false);
  }
  assert.equal(parseClientMessage(JSON.stringify({
    type: "takeLoot", corpseId: "corpse", takeAll: true,
  })).ok, true);
});

test("quantidade ausente em buyItem é rejeitada; em dropItem é opcional", () => {
  assert.equal(parseClientMessage(JSON.stringify({
    type: "buyItem", itemId: "item", npcId: "npc",
  })).ok, false);
  assert.equal(parseClientMessage(JSON.stringify({
    type: "dropItem", itemId: "item", x: 2, y: 2,
  })).ok, true);
});

test("pacote maior que 8 KiB é rejeitado antes do JSON.parse", () => {
  const payload = JSON.stringify({ type: "chat", message: "x".repeat(MAX_PACKET_BYTES) });
  assert.deepEqual(parseClientMessage(payload), { ok: false, reason: "too_large" });
});

test("tamanho de pacote mede bytes UTF-8, não caracteres", () => {
  // Emoji usa quatro bytes em UTF-8. A mensagem não pode contornar o limite.
  const payload = JSON.stringify({ type: "chat", message: "😀".repeat(2200) });
  assert.equal(parseClientMessage(payload).ok, false);
});

test("o parser pode receber mensagens JSON com escapes válidos", () => {
  const raw = '{"type":"chat","message":"Olá \\u263a"}';
  const parsed = parseClientMessage(raw);
  assert.equal(parsed.ok, true);
  if (parsed.ok && parsed.message.type === "chat") {
    assert.equal(parsed.message.message, "Olá ☺");
  }
});

test("limiter aceita até 30 mensagens na janela de um segundo", () => {
  const limiter = new MessageRateLimiter();
  assert.equal(MAX_MESSAGES_PER_SECOND, 30);
  for (let i = 0; i < MAX_MESSAGES_PER_SECOND; i++) {
    assert.equal(limiter.allow(1000), true);
  }
  assert.equal(limiter.allow(1000), false);
  assert.equal(limiter.allow(1999), false);
  assert.equal(limiter.allow(2000), true);
});

test("limiter rejeita relógio inválido e recupera após janela", () => {
  const limiter = new MessageRateLimiter();
  assert.equal(limiter.allow(NaN), false);
  assert.equal(limiter.allow(Infinity), false);
  assert.equal(limiter.allow(1000), true);
  assert.equal(limiter.allow(2500), true);
});

test("cada conexão tem limitador independente", () => {
  const a = new MessageRateLimiter();
  const b = new MessageRateLimiter();
  for (let i = 0; i < MAX_MESSAGES_PER_SECOND; i++) assert.equal(a.allow(0), true);
  assert.equal(a.allow(0), false);
  assert.equal(b.allow(0), true);
});

test("fila executa handlers assíncronos na ordem de chegada", async () => {
  const events: string[] = [];
  let release!: () => void;
  const errors: unknown[] = [];
  const queue = new OrderedMessageQueue((error) => errors.push(error));

  assert.equal(queue.enqueue(async () => {
    events.push("start A");
    await new Promise<void>((resolve) => { release = resolve; });
    events.push("end A");
  }), true);
  assert.equal(queue.enqueue(async () => { events.push("B"); }), true);
  assert.equal(queue.enqueue(async () => { events.push("C"); }), true);

  await Promise.resolve();
  assert.deepEqual(events, ["start A"]);
  release();
  // Microtask turn: task A and its .then handlers, then B and C.
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ["start A", "end A", "B", "C"]);
  assert.equal(queue.pending, 0);
  assert.deepEqual(errors, []);
});

test("erro de um handler não impede próximos comandos na fila", async () => {
  const errors: unknown[] = [];
  const events: number[] = [];
  const queue = new OrderedMessageQueue((error) => errors.push(error));
  queue.enqueue(() => { throw new Error("teste de erro"); });
  queue.enqueue(() => { events.push(2); });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(events, [2]);
  assert.equal(errors.length, 1);
  assert.equal(queue.pending, 0);
});

test("fila limita 32 comandos pendentes mesmo quando o handler demora", async () => {
  let release!: () => void;
  const queue = new OrderedMessageQueue(() => {});
  assert.equal(MAX_QUEUED_MESSAGES, 32);
  assert.equal(queue.enqueue(() =>
    new Promise<void>((resolve) => { release = resolve; })), true);
  for (let i = 1; i < MAX_QUEUED_MESSAGES; i++) {
    assert.equal(queue.enqueue(async () => {}), true);
  }
  assert.equal(queue.pending, 32);
  assert.equal(queue.enqueue(async () => {}), false);
  await Promise.resolve();
  release();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(queue.pending, 0);
});

test("a falha no callback de erro não interrompe o processamento da fila", async () => {
  const events: number[] = [];
  const queue = new OrderedMessageQueue(() => { throw new Error("logger offline"); });
  queue.enqueue(() => { throw new Error("handler"); });
  queue.enqueue(() => { events.push(2); });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(events, [2]);
});

test("takeLoot aceita payload de pegar tudo sem índice e rejeita sentinela negativa do Unity antigo", () => {
  const takeAll = { type: "takeLoot", corpseId: "corpse-1", takeAll: true };
  assert.equal(parseClientMessage(JSON.stringify(takeAll)).ok, true);
  const oldUnity = { ...takeAll, itemIndex: -1 };
  assert.deepEqual(parseClientMessage(JSON.stringify(oldUnity)), {
    ok: false, reason: "invalid_message",
  });
  assert.equal(parseClientMessage(JSON.stringify({
    ...takeAll, takeAll: false, itemIndex: 0,
  })).ok, true);
});
