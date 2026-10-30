/**
 * Operações bancárias autorizadas pelo servidor.
 *
 * Importante: o protocolo do Unity manda somente "amount" em deposit/withdraw.
 * Portanto não confiamos num npcId do cliente: a sessão criada em openBank
 * identifica qual banqueiro autorizou a operação.
 */
import type { WebSocket } from "ws";
import type { Player } from "../../game/entities/player";
import type { HandlerContext } from "./HandlerContext";
import { BankingSystem } from "../../game/systems/bankingSystem";
import { NpcInteractionSystem } from "../../game/systems/npcInteractionSystem";
import type {
  ClientOpenBankMessage,
  ClientDepositMessage,
  ClientWithdrawMessage,
  ClientCloseBankMessage,
} from "../messages";

/** Abre o banco apenas quando existe um banqueiro vivo, próximo e no mundo. */
export async function handleOpenBank(
  _ws: WebSocket,
  player: Player,
  msg: ClientOpenBankMessage,
  ctx: HandlerContext,
): Promise<void> {
  const npc = ctx.world.npcs.find((candidate) => candidate.id === msg.npcId);
  if (!npc || !NpcInteractionSystem.open(player, ctx.world, npc, "banker")) {
    // Uma abertura inválida também revoga autorizações anteriores.
    NpcInteractionSystem.close(player);
    ctx.packetSender.bank.sendBankError("Banqueiro inválido ou muito distante.");
    return;
  }

  ctx.packetSender.bank.sendBankWindow(npc.id, player.bankGold, player.gold);
}

/** Deposita apenas se uma janela de banco válida foi aberta anteriormente. */
export async function handleDeposit(
  _ws: WebSocket,
  player: Player,
  msg: ClientDepositMessage,
  ctx: HandlerContext,
): Promise<void> {
  if (!NpcInteractionSystem.getActive(player, ctx.world, "banker")) {
    ctx.packetSender.bank.sendBankResult(
      false, "Abra o banco próximo de um banqueiro para depositar.",
      player.bankGold, player.gold,
    );
    return;
  }

  const success = BankingSystem.depositGold(player, msg.amount);
  if (success) {
    ctx.packetSender.bank.sendBankResult(
      true, `Depositou ${msg.amount} gold.`, player.bankGold, player.gold,
    );
    ctx.packetSender.inventory.sendGold(player);
  } else {
    ctx.packetSender.bank.sendBankResult(
      false, "Falha no depósito. Verifique o valor ou saldo em mãos.",
      player.bankGold, player.gold,
    );
  }
}

/** Sacar usa a mesma autorização, sem aceitar o banco escolhido pelo cliente. */
export async function handleWithdraw(
  _ws: WebSocket,
  player: Player,
  msg: ClientWithdrawMessage,
  ctx: HandlerContext,
): Promise<void> {
  if (!NpcInteractionSystem.getActive(player, ctx.world, "banker")) {
    ctx.packetSender.bank.sendBankResult(
      false, "Abra o banco próximo de um banqueiro para sacar.",
      player.bankGold, player.gold,
    );
    return;
  }

  const success = BankingSystem.withdrawGold(player, msg.amount);
  if (success) {
    ctx.packetSender.bank.sendBankResult(
      true, `Sacou ${msg.amount} gold.`, player.bankGold, player.gold,
    );
    ctx.packetSender.inventory.sendGold(player);
  } else {
    ctx.packetSender.bank.sendBankResult(
      false, "Falha no saque. Verifique o saldo bancário.",
      player.bankGold, player.gold,
    );
  }
}

/**
 * O fechamento é idempotente. Um closeBank atrasado NÃO fecha a loja
 * que o jogador abriu depois, nem o banco de outro NPC.
 */
export function handleCloseBank(
  _ws: WebSocket,
  player: Player,
  msg: ClientCloseBankMessage,
  _ctx: HandlerContext,
): void {
  NpcInteractionSystem.closeIfActive(player, "banker", msg.npcId);
}
