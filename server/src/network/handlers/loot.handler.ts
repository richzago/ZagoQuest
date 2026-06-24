import { WebSocket } from "ws";
import { Player } from "../../game/entities/player";
import { HandlerContext } from "./HandlerContext";
import { Logger } from "../../game/core/logger/logger";
import { ItemRegistry } from "../../data/items/itemRegistry";

export async function handleLoot(
  ws: WebSocket,
  player: Player,
  msg: { corpseId: string },
  ctx: HandlerContext,
): Promise<void> {
  const { corpseId } = msg;
  Logger.system(`[Loot] handleLoot chamado para corpse ${corpseId}`);

  const corpse = ctx.world.corpses.find((c) => c.id === corpseId);
  if (!corpse) {
    ctx.packetSender.loot.sendLootError("Corpse not found");
    return;
  }

  const dx = Math.abs(corpse.position.x - player.position.x);
  const dy = Math.abs(corpse.position.y - player.position.y);
  if (dx + dy > 2) {
    ctx.packetSender.loot.sendLootError("Too far from corpse");
    return;
  }

  const items = corpse.loot.map((item) => ({
    itemId: item.itemId,
    amount: item.amount,
    itemName: ItemRegistry.get(item.itemId)?.name || item.itemId,
  }));

  ctx.packetSender.loot.sendLootWindow(corpse.id, items);
}

export async function handleTakeLoot(
  ws: WebSocket,
  player: Player,
  msg: { corpseId: string; takeAll: boolean; itemIndex?: number },
  ctx: HandlerContext,
): Promise<void> {
  const corpse = ctx.world.corpses.find((c) => c.id === msg.corpseId);
  if (!corpse) {
    ctx.packetSender.loot.sendLootError("Corpse not found");
    return;
  }

  const dx = Math.abs(corpse.position.x - player.position.x);
  const dy = Math.abs(corpse.position.y - player.position.y);
  if (dx + dy > 2) {
    ctx.packetSender.loot.sendLootError("Too far from corpse");
    return;
  }

  if (msg.takeAll) {
    for (const item of corpse.loot) {
      player.addItem(item.itemId, item.amount);
      Logger.loot(
        `Jogador ${player.name} recebeu ${item.amount}x ${item.itemId} do corpse ${corpse.id}`,
      );
    }
    ctx.world.removeCorpse(corpse);
    ctx.wsServer.broadcastDespawn(corpse.id);
    ctx.packetSender.loot.sendLootTaken(corpse.id);
    ctx.packetSender.inventory.sendInventory(player);
  } else if (msg.itemIndex !== undefined) {
    const item = corpse.loot[msg.itemIndex];
    if (item) {
      player.addItem(item.itemId, item.amount);
      Logger.loot(
        `Jogador ${player.name} recebeu ${item.amount}x ${item.itemId} do corpse ${corpse.id}`,
      );
      corpse.loot.splice(msg.itemIndex, 1);
      if (corpse.loot.length === 0) {
        ctx.world.removeCorpse(corpse);
        ctx.wsServer.broadcastDespawn(corpse.id);
      }
      ctx.packetSender.loot.sendLootTaken(corpse.id, msg.itemIndex);
      ctx.packetSender.inventory.sendInventory(player);
    } else {
      ctx.packetSender.loot.sendLootError("Item not found");
    }
  }
}
