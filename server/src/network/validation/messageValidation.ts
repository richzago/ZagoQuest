/**
 * Runtime validation for every WebSocket command sent by the Unity client.
 *
 * TypeScript interfaces disappear at runtime; parsing JSON is NOT validation.
 * This schema is the trust boundary between untrusted packets and game logic.
 * Unknown properties are rejected (rather than forwarded to game handlers).
 */
import { z } from "zod";
import type { ClientMessage } from "../messages";

export const MAX_PACKET_BYTES = 8 * 1024; // Maximum JSON frame, before parsing.
export const MAX_CHAT_LENGTH = 500;
export const MAX_IDENTIFIER_LENGTH = 128;

// UUIDs and path-like item IDs have different formats, but both must be strings.
const identifier = z.string().trim().min(1).max(MAX_IDENTIFIER_LENGTH);
const positiveAmount = z.number().int().positive().safe();
const tileCoordinate = z.number().int().safe();
const direction = z.enum([
  "north", "south", "east", "west",
  "northeast", "northwest", "southeast", "southwest",
]);

// Every entry in handlers/index.ts must have a matching runtime schema here.
// closeBank/closeShop require the exact NPC ID to avoid stale UI races.
// strictObject rejects unexpected fields, including client-supplied identities.
export const clientMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("move"), x: tileCoordinate, y: tileCoordinate }),
  z.strictObject({ type: z.literal("moveDir"), dir: direction }),
  z.strictObject({ type: z.literal("attack"), targetId: identifier }),
  z.strictObject({ type: z.literal("startAutoAttack"), targetId: identifier }),
  z.strictObject({ type: z.literal("stopAutoAttack") }),
  z.strictObject({ type: z.literal("chat"), message: z.string().trim().min(1).max(MAX_CHAT_LENGTH) }),
  z.strictObject({ type: z.literal("loot"), corpseId: identifier }),
  z.strictObject({
    type: z.literal("takeLoot"),
    corpseId: identifier,
    takeAll: z.boolean(),
    itemIndex: z.number().int().nonnegative().safe().optional(),
  }).refine((msg) => msg.takeAll || msg.itemIndex !== undefined, {
    message: "itemIndex é obrigatório para loot individual.",
  }),
  z.strictObject({ type: z.literal("useItem"), itemId: identifier }),
  z.strictObject({ type: z.literal("equipItem"), itemId: identifier }),
  z.strictObject({ type: z.literal("unequipItem"), slot: z.string().trim().min(1).max(32) }),
  z.strictObject({
    type: z.literal("dropItem"),
    itemId: identifier,
    amount: positiveAmount.optional(), // Legado: handler adota 1 quando omitido.
    x: tileCoordinate,
    y: tileCoordinate,
  }),
  z.strictObject({ type: z.literal("pickupItem"), itemId: identifier }),
  z.strictObject({ type: z.literal("openShop"), npcId: identifier }),
  z.strictObject({
    type: z.literal("buyItem"),
    npcId: identifier,
    itemId: identifier,
    amount: positiveAmount,
  }),
  z.strictObject({ type: z.literal("openBank"), npcId: identifier }),
  z.strictObject({ type: z.literal("deposit"), amount: positiveAmount }),
  z.strictObject({ type: z.literal("withdraw"), amount: positiveAmount }),
  z.strictObject({ type: z.literal("closeBank"), npcId: identifier }),
  z.strictObject({ type: z.literal("closeShop"), npcId: identifier }),
]);

export type ParseMessageResult =
  | { ok: true; message: ClientMessage }
  | { ok: false; reason: "too_large" | "invalid_json" | "invalid_message" };

/**
 * Checks byte size before JSON.parse, then checks every field at runtime.
 * Returns a discriminated result: handlers never receive unvalidated data.
 */
export function parseClientMessage(raw: string): ParseMessageResult {
  if (Buffer.byteLength(raw, "utf8") > MAX_PACKET_BYTES) {
    return { ok: false, reason: "too_large" };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  const parsed = clientMessageSchema.safeParse(decoded);
  if (!parsed.success) return { ok: false, reason: "invalid_message" };

  // Schema's 18 variants have the same shape as ClientMessage interfaces.
  return { ok: true, message: parsed.data as ClientMessage };
}
