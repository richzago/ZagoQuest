/**
 * C7 — ponte WebSocket para a pesca já existente no servidor.
 * O Unity pede start/cancel e apenas recebe estados; Node valida rod, isca,
 * estado e proximidade. A regra de água via Y>=8 é provisória e auditada.
 */
import { WebSocket } from "ws";
import type { Player } from "../../game/entities/player";
import type { HandlerContext } from "./HandlerContext";
import { FishingSystem } from "../../game/systems/fishingSystem";
import { ItemRegistry } from "../../data/items/itemRegistry";
import type { ClientStartFishingMessage, ClientCancelFishingMessage } from "../messages";

function feedback(ws: WebSocket, state: "started"|"completed"|"cancelled"|"rejected",
  message: string, durationMs = 0): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "fishingStatus", state, message, durationMs }));
}

export function handleStartFishing(
  ws: WebSocket, player: Player, _msg: ClientStartFishingMessage, ctx: HandlerContext,
): void {
  if (player.isFishing) {
    feedback(ws, "rejected", "Você já está pescando.");
    return;
  }
  const started = FishingSystem.startFishing(player, ctx.world, {
    onComplete: (reward) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      let name = reward?.itemId ?? "";
      if (reward) {
        try { name = ItemRegistry.get(reward.itemId).name; }
        catch { name = reward.itemId.split("/").pop()?.replace(/_/g, " ") ?? reward.itemId; }
      }
      const message = reward
        ? `Pesca concluída: ${reward.amount}x ${name}.`
        : "Pesca concluída, mas nenhum item foi adicionado.";
      feedback(ws, "completed", message);
      ctx.packetSender.inventory.sendInventory(player);
      ctx.packetSender.inventory.sendPlayerStats(player);
    },
    onCancel: () => feedback(ws, "cancelled", "Pesca interrompida."),
  });
  if (!started) {
    feedback(ws, "rejected",
      "Pesca indisponível: verifique sua vara, água próxima ou personagem.");
    return;
  }
  // Apenas o servidor informa o tempo da vara; UI não pode antecipar prêmio.
  feedback(ws, "started", "Pescando... Aguarde a fisgada.",
    FishingSystem.durationMs(player));
  ctx.packetSender.inventory.sendInventory(player); // isca opcional foi consumida
}

export function handleCancelFishing(
  ws: WebSocket, player: Player, _msg: ClientCancelFishingMessage, _ctx: HandlerContext,
): void {
  if (!player.isFishing) {
    feedback(ws, "rejected", "Nenhuma pescaria em andamento.");
    return;
  }
  FishingSystem.cancelFishing(player);
}
