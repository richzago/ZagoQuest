/**
 * bank.handler.ts
 *
 * Handlers relacionados ao banco.
 *
 * @module network/handlers/bank
 */

import { WebSocket } from "ws";
import { Player } from "../../game/entities/player";
import { HandlerContext } from "./HandlerContext";
import { BankingSystem } from "../../game/systems/bankingSystem";

/**
 * Abre a janela do banco.
 */
export async function handleOpenBank(
  ws: WebSocket,
  player: Player,
  msg: { npcId: string },
  ctx: HandlerContext,
): Promise<void> {
  const npc = ctx.world.npcs.find((n) => n.id === msg.npcId);
  if (!npc || npc.npcType !== "banker") {
    ctx.packetSender.bank.sendBankError("NPC não é um banqueiro.");
    return;
  }

  ctx.packetSender.bank.sendBankWindow(npc.id, player.bankGold, player.gold);
}

/**
 * Deposita gold no banco.
 */
export async function handleDeposit(
  ws: WebSocket,
  player: Player,
  msg: { amount: number },
  ctx: HandlerContext,
): Promise<void> {
  const success = BankingSystem.depositGold(player, msg.amount);
  if (success) {
    ctx.packetSender.bank.sendBankResult(
      true,
      `Depositou ${msg.amount} gold.`,
      player.bankGold,
      player.gold,
    );
    ctx.packetSender.inventory.sendGold(player);
  } else {
    ctx.packetSender.bank.sendBankResult(
      false,
      "Falha no depósito. Verifique o valor ou saldo em mãos.",
      player.bankGold,
      player.gold,
    );
  }
}

/**
 * Saca gold do banco.
 */
export async function handleWithdraw(
  ws: WebSocket,
  player: Player,
  msg: { amount: number },
  ctx: HandlerContext,
): Promise<void> {
  const success = BankingSystem.withdrawGold(player, msg.amount);
  if (success) {
    ctx.packetSender.bank.sendBankResult(
      true,
      `Sacou ${msg.amount} gold.`,
      player.bankGold,
      player.gold,
    );
    ctx.packetSender.inventory.sendGold(player);
  } else {
    ctx.packetSender.bank.sendBankResult(
      false,
      "Falha no saque. Verifique o saldo bancário.",
      player.bankGold,
      player.gold,
    );
  }
}
