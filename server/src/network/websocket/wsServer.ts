/**
 * wsServer.ts
 *
 * Servidor WebSocket para comunicação em tempo real com o cliente Unity.
 * Gerencia conexões, movimentos, chat, combate, spawn/despawn, loot e inventário.
 * Agora com suporte a movimento por direção (grid) e ataque automático.
 *
 * @module network/websocket/wsServer
 */

import { Server as HttpServer, IncomingMessage } from "http";
import { WebSocketServer as WSServer, WebSocket } from "ws";
import { World } from "../../game/world/World";
import { Player } from "../../game/entities/player";
import { Logger } from "../../game/core/logger/logger";
import { processChatCommand } from "../../game/chat/chatCommands";
import { ChatSystem } from "../../game/chat/chatSystem";
import { CombatSystem } from "../../game/combat/combatSystem";
import { Monster } from "../../game/entities/monster";
import { Corpse } from "../../game/entities/corpse";
import { ItemRegistry } from "../../data/items/itemRegistry";
import { BankingSystem } from "../../game/systems/bankingSystem";
import { ShopSystem } from "../../game/systems/shopSystem";
import { EquipmentSlot } from "../../shared/enums/equipmentSlot.enum";
import { ItemOnGround } from "../../game/entities/itemOnGround";
import { generateId } from "../../shared/utils/idUtils";
import { handleMove, handleMoveDir } from "../handlers/move.handler";
import { HandlerContext } from "../handlers/HandlerContext";
import { PacketSender } from "../senders/PacketSender";
import { handleChat } from "../handlers/chat.handler";
import {
  handleAttack,
  handleStartAutoAttack,
  handleStopAutoAttack,
} from "../handlers/attack.handler";
import { handleLoot, handleTakeLoot } from "../handlers/loot.handler";

/**
 * Direções possíveis para movimento estilo Tibia.
 */
type Direction =
  | "north"
  | "south"
  | "east"
  | "west"
  | "northeast"
  | "northwest"
  | "southeast"
  | "southwest";

/**
 * Servidor WebSocket responsável por receber comandos dos clientes
 * e enviar atualizações do mundo.
 */
export class WebSocketServer {
  private wss: WSServer;
  private world: World;
  private clients: Map<WebSocket, Player> = new Map(); // Mapeamento socket -> jogador
  private static instance: WebSocketServer;

  constructor(server: HttpServer, world: World) {
    WebSocketServer.instance = this;
    this.world = world;
    this.wss = new WSServer({ server });
    this.init();
  }

  private init(): void {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      Logger.system(`Cliente conectado: ${req.socket.remoteAddress}`);

      const player = this.world.players[0];
      if (player) {
        this.clients.set(ws, player);
        Logger.system(`Jogador ${player.name} (ID ${player.id}) associado ao socket.`);
        this.sendInventory(ws, player);
        this.sendPlayerStats(ws, player);
      } else {
        Logger.error("Nenhum jogador disponível para associar ao WebSocket");
        ws.close();
        return;
      }

      this.sendInitialState(ws, player);
      this.sendSpawnEntities(ws);

      ws.on("message", async (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          const ctx = new HandlerContext(this.world, this, new PacketSender(ws));
          switch (msg.type) {
            case "move":
              await handleMove(ws, player, msg, ctx);
              break;
            case "moveDir":
              handleMoveDir(ws, player, msg, ctx);
              break;
            case "attack":
              await handleAttack(ws, player, msg, ctx);
              break;
            case "startAutoAttack":
              handleStartAutoAttack(ws, player, msg, ctx);
              break;
            case "stopAutoAttack":
              handleStopAutoAttack(ws, player, msg, ctx);
              break;
            case "chat":
              await handleChat(ws, player, msg, ctx);
              break;

            case "loot":
              await handleLoot(ws, player, msg, ctx);
              break;
            case "takeLoot":
              await handleTakeLoot(ws, player, msg, ctx);
              break;
            case "useItem":
              await this.handleUseItem(ws, msg);
              break;
            case "dropItem":
              await this.handleDropItem(ws, msg);
              break;
            case "openShop":
              await this.handleOpenShop(ws, msg);
              break;
            case "openBank":
              await this.handleOpenBank(ws, msg);
              break;
            case "buyItem":
              await this.handleBuyItem(ws, msg);
              break;
            case "deposit":
              await this.handleDeposit(ws, msg);
              break;
            case "withdraw":
              await this.handleWithdraw(ws, msg);
              break;
            case "equipItem":
              await this.handleEquipItem(ws, msg);
              break;
            case "unequipItem":
              await this.handleUnequipItem(ws, msg);
              break;
            case "dropItem":
              await this.handleDropItem(ws, msg);
              break;
            case "pickupItem":
              await this.handlePickupItem(ws, msg);
              break;
            default:
              Logger.warn(`Tipo de mensagem desconhecido: ${msg.type}`);
          }
        } catch (err) {
          Logger.error(`Erro ao processar mensagem: ${err}`);
        }
      });

      ws.on("close", () => {
        Logger.system("Cliente desconectado");
        this.clients.delete(ws);
      });
    });
  }

  // =========================
  // MÉTODOS EXISTENTES (MOVIMENTO, CHAT, LOOT, INVENTÁRIO, ECONOMIA)
  // =========================

  private sendInitialState(ws: WebSocket, player: Player): void {
    ws.send(
      JSON.stringify({
        type: "init",
        playerId: player.id,
        x: player.position.x,
        y: player.position.y,
      }),
    );
    Logger.world(`Estado inicial enviado para ${player.name}`);
  }

  /**
   * Envia ao cliente todos os monstros e NPCs atualmente vivos no mundo.
   * @param ws - WebSocket do cliente.
   */

  // =========================
  // 1. ENVIA MONSTERS
  // =========================

  private sendSpawnEntities(ws: WebSocket): void {
    for (const monster of this.world.monsters) {
      ws.send(
        JSON.stringify({
          type: "spawn",
          id: monster.id,
          name: monster.name,
          x: monster.position.x,
          y: monster.position.y,
          hp: monster.hp,
          maxHp: monster.maxHp,
        }),
      );
    }
    Logger.world(`Enviados ${this.world.monsters.length} monstros para o cliente`);

    // =========================
    // 2. ENVIA NPCS
    // =========================
    for (const npc of this.world.npcs) {
      ws.send(
        JSON.stringify({
          type: "spawn",
          id: npc.id,
          name: npc.name,
          x: npc.position.x,
          y: npc.position.y,
          npcType: npc.npcType, // ← ESSENCIAL para o cliente saber o tipo (merchant, banker, etc.)
        }),
      );
    }
    Logger.world(`Enviados ${this.world.npcs.length} NPCs para o cliente`);
  }

  private async handleMove(ws: WebSocket, msg: { x: number; y: number }): Promise<void> {
    const player = this.clients.get(ws);
    if (!player) return;

    const { x, y } = msg;
    if (this.world.isPositionWalkable(x, y, player.id)) {
      player.position.x = x;
      player.position.y = y;
      ws.send(JSON.stringify({ type: "position", x, y }));
      this.broadcastMove(player.id, x, y, ws);
    } else {
      ws.send(JSON.stringify({ type: "position", x: player.position.x, y: player.position.y }));
    }

    const talkingNpc = this.world.npcs.find(
      (n) => n.isTalking && n.talkingToPlayerId === player.id,
    );
    if (talkingNpc) {
      const dx = Math.abs(talkingNpc.position.x - player.position.x);
      const dy = Math.abs(talkingNpc.position.y - player.position.y);
      if (dx + dy > 2) {
        await processChatCommand("/bye", player, this.world);
        Logger.warn(`Auto-bye: ${player.name} se afastou de ${talkingNpc.name}`);
      }
    }
  }

  private async handleUseItem(ws: WebSocket, msg: { itemId: string }): Promise<void> {
    const player = this.clients.get(ws);
    if (!player) return;

    const { itemId } = msg;
    const item = ItemRegistry.get(itemId);
    if (!item) {
      this.sendItemUsed(ws, itemId, false, "Item não encontrado.");
      return;
    }

    if (!player.hasItem(itemId, 1)) {
      this.sendItemUsed(ws, itemId, false, "Você não possui este item.");
      return;
    }

    if (item.type === "consumable") {
      let message = "";
      let effectApplied = false;

      const healAmount = (item as any).healAmount ?? (item as any).heal ?? 0;
      if (healAmount > 0) {
        const actualHeal = Math.min(player.maxHp - player.hp, healAmount);
        if (actualHeal > 0) {
          player.hp += actualHeal;
          message = `Você recuperou ${actualHeal} HP.`;
          effectApplied = true;
        } else {
          message = "Seu HP já está cheio.";
        }
      }

      const manaAmount = (item as any).manaAmount ?? (item as any).mana ?? 0;
      if (manaAmount > 0) {
        const actualMana = Math.min(player.maxMana - player.mana, manaAmount);
        if (actualMana > 0) {
          player.mana += actualMana;
          message = `Você recuperou ${actualMana} de mana.`;
          effectApplied = true;
        } else if (!effectApplied) {
          message = "Sua mana já está cheia.";
        }
      }

      if (!effectApplied) {
        this.sendItemUsed(ws, itemId, false, message);
        return;
      }

      player.removeItem(itemId, 1);
      this.sendItemUsed(ws, itemId, true, message);
      this.sendInventory(ws, player);
      this.sendPlayerStats(ws, player);
    } else if (item.type === "equipment") {
      const success = player.equipItem(itemId);
      if (success) {
        this.sendItemUsed(ws, itemId, true, `Você equipou ${item.name}.`);
        this.sendInventory(ws, player);
        this.sendPlayerStats(ws, player);
      } else {
        this.sendItemUsed(
          ws,
          itemId,
          false,
          "Não foi possível equipar este item (nível, slot, etc.).",
        );
      }
    } else {
      this.sendItemUsed(ws, itemId, false, "Este item não pode ser usado ou equipado.");
    }
  }

  /**
   * Processa o drop de um item no chão.
   * Suporta tanto itens do inventário quanto itens equipados.
   * @param ws - WebSocket do cliente.
   * @param msg - Objeto com `itemId`, `amount` (opcional), `x` e `y` (posição no mundo).
   */
  private async handleDropItem(
    ws: WebSocket,
    msg: { itemId: string; amount?: number; x: number; y: number },
  ): Promise<void> {
    const player = this.clients.get(ws);
    if (!player) {
      ws.send(JSON.stringify({ type: "dropError", message: "Jogador não encontrado." }));
      return;
    }

    const { itemId, amount = 1, x, y } = msg;

    // 1. Verifica distância máxima (Manhattan 2 tiles)
    const dx = Math.abs(Math.floor(x) - Math.floor(player.position.x));
    const dy = Math.abs(Math.floor(y) - Math.floor(player.position.y));
    if (dx + dy > 2) {
      ws.send(JSON.stringify({ type: "dropError", message: "Muito longe para dropar." }));
      return;
    }

    // 2. Verifica se o jogador possui o item no inventário
    if (!player.hasItem(itemId, amount)) {
      // 2.1 Se não tiver no inventário, verifica se está equipado
      let equippedSlot: EquipmentSlot | null = null;
      for (const [slot, equippedItemId] of player.equipment.entries()) {
        if (equippedItemId === itemId) {
          equippedSlot = slot;
          break;
        }
      }

      if (equippedSlot !== null) {
        // Desequipa o item (move para o inventário)
        const unequipSuccess = player.unequipItem(equippedSlot);
        if (!unequipSuccess) {
          ws.send(
            JSON.stringify({ type: "dropError", message: "Não foi possível desequipar o item." }),
          );
          return;
        }
        Logger.system(`${player.name} desequipou ${itemId} para dropar.`);
      } else {
        ws.send(JSON.stringify({ type: "dropError", message: "Você não possui este item." }));
        return;
      }
    }

    // 3. Remove do inventário (agora o item está no inventário, seja por já estar ou por ter sido desequipado)
    if (!player.removeItem(itemId, amount)) {
      ws.send(JSON.stringify({ type: "dropError", message: "Erro ao remover o item." }));
      return;
    }

    // 4. Busca o nome do item
    const itemDef = ItemRegistry.get(itemId);
    const itemName = itemDef?.name || itemId;

    // 5. Cria o item no chão
    const newId = generateId();
    const itemOnGround = new ItemOnGround(
      newId,
      itemId,
      amount,
      Math.floor(x),
      Math.floor(y),
      itemName,
    );
    this.world.addItemOnGround(itemOnGround);

    // 6. Notifica todos os clientes sobre o novo item no chão
    const wsServer = WebSocketServer.getInstance();
    if (wsServer) {
      wsServer.broadcastSpawnItemOnGround(itemOnGround);
    }

    // 7. Envia inventário e equipamento atualizados
    this.sendInventory(ws, player);
    this.sendEquipment(ws, player);

    Logger.loot(
      `${player.name} dropou ${amount}x ${itemId} em (${Math.floor(x)}, ${Math.floor(y)})`,
    );
  }

  private async handleOpenShop(ws: WebSocket, msg: { npcId: string }): Promise<void> {
    // Logger.system(`[SHOP] handleOpenShop chamado com msg: ${JSON.stringify(msg)}`);
    const player = this.clients.get(ws);
    if (!player) {
      Logger.error("[SHOP] Player não encontrado");
      return;
    }
    const npcId = msg.npcId;
    // Logger.system(`[SHOP] Procurando NPC com id ou nome: ${npcId}`);
    const npc = this.world.npcs.find((n) => n.id === npcId || n.name.toLowerCase() === npcId);
    if (!npc) {
      Logger.error(`[SHOP] NPC não encontrado: ${npcId}`);
      ws.send(JSON.stringify({ type: "shopError", message: "NPC não encontrado." }));
      return;
    }
    // Logger.system(`[SHOP] NPC encontrado: ${npc.name}, type=${npc.npcType}`);
    if (npc.npcType !== "merchant") {
      Logger.error(`[SHOP] NPC não é merchant: ${npc.npcType}`);
      ws.send(JSON.stringify({ type: "shopError", message: "NPC não é comerciante." }));
      return;
    }
    if (!npc.shopItems || npc.shopItems.length === 0) {
      Logger.error(`[SHOP] Merchant sem itens: ${npc.name}`);
      ws.send(JSON.stringify({ type: "shopError", message: "Comerciante não tem itens." }));
      return;
    }

    const shopItemsForClient = npc.shopItems.map((item) => ({
      itemId: item.itemId,
      name: ItemRegistry.get(item.itemId)?.name || item.itemId,
      price: item.buyPrice,
      stock: item.stock ?? -1,
    }));

    ws.send(
      JSON.stringify({
        type: "shopWindow",
        npcId: npc.id,
        items: shopItemsForClient,
      }),
    );
    Logger.system(`Loja aberta para ${player.name} (NPC: ${npc.name})`);
  }

  private async handleBuyItem(ws: WebSocket, msg: any): Promise<void> {
    const player = this.clients.get(ws);
    if (!player) return;

    const { npcId, itemId, amount } = msg;
    const npc = this.world.npcs.find((n) => n.id === npcId);
    if (!npc || npc.npcType !== "merchant") {
      ws.send(
        JSON.stringify({ type: "buyResult", success: false, message: "Comerciante inválido." }),
      );
      return;
    }

    const success = ShopSystem.buyItem(player, npc, itemId, amount);
    if (success) {
      ws.send(
        JSON.stringify({
          type: "buyResult",
          success: true,
          message: `Comprou ${amount}x ${ItemRegistry.get(itemId)?.name || itemId}.`,
        }),
      );
      this.sendInventory(ws, player);
      this.sendPlayerStats(ws, player);
      this.sendGold(ws, player);
    } else {
      ws.send(
        JSON.stringify({
          type: "buyResult",
          success: false,
          message: "Não foi possível comprar. Verifique gold ou estoque.",
        }),
      );
    }
  }

  /**
   * Processa o comando de equipar um item do inventário.
   * @param ws - WebSocket do cliente
   * @param msg - Objeto com `itemId` (string)
   */
  private async handleEquipItem(ws: WebSocket, msg: { itemId: string }): Promise<void> {
    const player = this.clients.get(ws);
    if (!player) {
      ws.send(JSON.stringify({ type: "error", message: "Jogador não encontrado." }));
      return;
    }

    const { itemId } = msg;
    const success = player.equipItem(itemId);
    if (success) {
      ws.send(
        JSON.stringify({ type: "itemUsed", itemId, success: true, message: "Item equipado." }),
      );
      this.sendInventory(ws, player);
      this.sendPlayerStats(ws, player);
      this.sendEquipment(ws, player);
    } else {
      ws.send(
        JSON.stringify({
          type: "itemUsed",
          itemId,
          success: false,
          message: "Não foi possível equipar o item.",
        }),
      );
    }
  }

  /**
   * Processa o comando de desequipar item de um slot específico.
   * @param ws - WebSocket do cliente
   * @param msg - Objeto com `slot` (string)
   */
  private async handleUnequipItem(ws: WebSocket, msg: { slot: string }): Promise<void> {
    const player = this.clients.get(ws);
    if (!player) {
      ws.send(JSON.stringify({ type: "error", message: "Jogador não encontrado." }));
      return;
    }

    // Converte a string para o enum EquipmentSlot
    const slotKey = msg.slot.toUpperCase() as keyof typeof EquipmentSlot;
    const slot = EquipmentSlot[slotKey];

    if (slot === undefined) {
      ws.send(JSON.stringify({ type: "error", message: "Slot inválido." }));
      Logger.warn(`[Unequip] Slot inválido recebido: ${msg.slot}`);
      return;
    }

    const success = player.unequipItem(slot);
    if (success) {
      this.sendInventory(ws, player);
      this.sendPlayerStats(ws, player);
      this.sendEquipment(ws, player);
      ws.send(
        JSON.stringify({ type: "unequipResult", success: true, message: "Item desequipado." }),
      );
    } else {
      ws.send(
        JSON.stringify({ type: "unequipResult", success: false, message: "Falha ao desequipar." }),
      );
    }
  }

  /**
   * Processa o pickup de um item do chão.
   * @param ws - WebSocket do cliente.
   * @param msg - Objeto com `itemId` (ID do item no chão).
   */
  private async handlePickupItem(ws: WebSocket, msg: { itemId: string }): Promise<void> {
    Logger.system(`[Pickup] Recebido pickup para item ${msg.itemId}`);
    const player = this.clients.get(ws);
    if (!player) {
      ws.send(JSON.stringify({ type: "error", message: "Jogador não encontrado." }));
      return;
    }

    const itemOnGround = this.world.getItemOnGround(msg.itemId);
    if (!itemOnGround) {
      ws.send(JSON.stringify({ type: "pickupError", message: "Item não encontrado no chão." }));
      return;
    }

    // 1. Verifica distância máxima (Manhattan 2 tiles)
    const dx = Math.abs(itemOnGround.position.x - player.position.x);
    const dy = Math.abs(itemOnGround.position.y - player.position.y);
    if (dx + dy > 2) {
      ws.send(JSON.stringify({ type: "pickupError", message: "Muito longe para pegar." }));
      return;
    }

    // 2. Adiciona ao inventário do jogador
    player.addItem(itemOnGround.itemId, itemOnGround.amount);

    // 3. Remove do mundo
    this.world.removeItemOnGround(itemOnGround);

    // 4. Notifica todos os clientes para remover o item visualmente
    const wsServer = WebSocketServer.getInstance();
    if (wsServer) {
      wsServer.broadcastDespawn(itemOnGround.id);
    }

    // 5. Envia inventário atualizado
    this.sendInventory(ws, player);

    Logger.loot(`${player.name} pegou ${itemOnGround.amount}x ${itemOnGround.itemId} do chão.`);
  }

  private sendGold(ws: WebSocket, player: Player): void {
    ws.send(
      JSON.stringify({
        type: "goldUpdate",
        gold: player.gold,
        bankGold: player.bankGold,
      }),
    );
  }

  /**
   * Envia uma mensagem de spawn de um item no chão para todos os clientes.
   * @param itemOnGround - Item no chão a ser spawnado.
   */
  public broadcastSpawnItemOnGround(itemOnGround: ItemOnGround): void {
    const msg = JSON.stringify({
      type: "spawn",
      id: itemOnGround.id,
      name: itemOnGround.itemName,
      x: itemOnGround.position.x,
      y: itemOnGround.position.y,
      itemId: itemOnGround.itemId,
      amount: itemOnGround.amount,
      isItem: true, // ← indica que é um item, não um monstro/NPC
    });
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(msg);
      }
    }
  }

  private async handleOpenBank(ws: WebSocket, msg: { npcId: string }): Promise<void> {
    const player = this.clients.get(ws);
    if (!player) return;

    const npc = this.world.npcs.find((n) => n.id === msg.npcId);
    if (!npc || npc.npcType !== "banker") {
      ws.send(JSON.stringify({ type: "bankError", message: "NPC não é um banqueiro." }));
      return;
    }

    ws.send(
      JSON.stringify({
        type: "bankWindow",
        npcId: npc.id,
        bankGold: player.bankGold,
        gold: player.gold,
      }),
    );
    Logger.system(`Banco aberto para ${player.name}`);
  }

  private async handleDeposit(ws: WebSocket, msg: { amount: number }): Promise<void> {
    const player = this.clients.get(ws);
    if (!player) return;

    const success = BankingSystem.depositGold(player, msg.amount);
    if (success) {
      ws.send(
        JSON.stringify({
          type: "bankResult",
          success: true,
          message: `Depositou ${msg.amount} gold.`,
          bankGold: player.bankGold,
          gold: player.gold,
        }),
      );
      this.sendGold(ws, player);
    } else {
      ws.send(
        JSON.stringify({
          type: "bankResult",
          success: false,
          message: "Falha no depósito. Verifique o valor ou saldo em mãos.",
        }),
      );
    }
  }

  private async handleWithdraw(ws: WebSocket, msg: { amount: number }): Promise<void> {
    const player = this.clients.get(ws);
    if (!player) return;

    const success = BankingSystem.withdrawGold(player, msg.amount);
    if (success) {
      ws.send(
        JSON.stringify({
          type: "bankResult",
          success: true,
          message: `Sacou ${msg.amount} gold.`,
          bankGold: player.bankGold,
          gold: player.gold,
        }),
      );
      this.sendGold(ws, player);
    } else {
      ws.send(
        JSON.stringify({
          type: "bankResult",
          success: false,
          message: "Falha no saque. Verifique o saldo bancário.",
        }),
      );
    }
  }

  // =========================
  // BROADCASTS E UTILITÁRIOS
  // =========================

  public broadcastDamage(targetId: string, newHp: number, maxHp: number, damage: number): void {
    const msg = JSON.stringify({ type: "damage", targetId, newHp, maxHp, damage });
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN) socket.send(msg);
    }
  }

  public broadcastChat(senderName: string, message: string, channel: string = "local"): void {
    const formatted = `[${channel.toUpperCase()}] ${senderName}: ${message}`;
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify({ type: "chat", message: formatted }));
    }
  }

  public broadcastMove(entityId: string, x: number, y: number, excludeSocket?: WebSocket): void {
    const msg = JSON.stringify({ type: "move", id: entityId, x, y });
    for (const [socket] of this.clients.entries()) {
      if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) socket.send(msg);
    }
  }

  public broadcastSpawn(monster: Monster): void {
    const msg = JSON.stringify({
      type: "spawn",
      id: monster.id,
      name: monster.name,
      x: monster.position.x,
      y: monster.position.y,
      hp: monster.hp,
      maxHp: monster.maxHp,
    });
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN) socket.send(msg);
    }
  }

  public broadcastSpawnCorpse(corpse: Corpse): void {
    const msg = JSON.stringify({
      type: "spawn",
      id: corpse.id,
      name: "Corpse",
      x: corpse.position.x,
      y: corpse.position.y,
    });
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN) socket.send(msg);
    }
  }

  public broadcastDespawn(entityId: string): void {
    Logger.system(`[DESPAWN] Enviando despawn para entidade ${entityId}`);
    const msg = JSON.stringify({ type: "despawn", id: entityId });
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN) socket.send(msg);
    }
  }

  public sendChatToPlayer(playerId: string, message: string): void {
    for (const [ws, player] of this.clients.entries()) {
      if (player.id === playerId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "chat", message }));
        break;
      }
    }
  }

  private sendInventory(ws: WebSocket, player: Player): void {
    const itemsArray: { itemId: string; amount: number }[] = [];
    for (const [itemId, qty] of player.inventory.entries()) {
      itemsArray.push({ itemId, amount: qty });
    }
    const payload = JSON.stringify({
      type: "inventory",
      gold: player.gold,
      items: itemsArray,
    });
    ws.send(payload);
    Logger.loot(`Inventário enviado para ${player.name} (${player.inventory.size} tipos de itens)`);
    Logger.system(`[INVENTORY DEBUG] Payload enviado: ${payload}`);
  }

  private sendItemUsed(ws: WebSocket, itemId: string, success: boolean, message: string): void {
    ws.send(JSON.stringify({ type: "itemUsed", itemId, success, message }));
  }

  private sendPlayerStats(ws: WebSocket, player: Player): void {
    ws.send(
      JSON.stringify({
        type: "playerStats",
        hp: player.hp,
        maxHp: player.maxHp,
        mana: player.mana,
        maxMana: player.maxMana,
        level: player.level,
        attack: player.attack,
        defense: player.defense,
      }),
    );
  }

  /**
   * Envia uma mensagem JSON qualquer para um jogador específico.
   * @param playerId - ID do jogador destino.
   * @param message - String JSON a ser enviada.
   */
  public sendToPlayer(playerId: string, message: string): void {
    for (const [ws, player] of this.clients.entries()) {
      if (player.id === playerId && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        break;
      }
    }
  }

  /**
   * Envia ao cliente a lista de itens equipados (como array de { slot, itemId }).
   * Formato consistente com o inventário (array de objetos).
   */
  private sendEquipment(ws: WebSocket, player: Player): void {
    const itemsArray = Array.from(player.equipment.entries()).map(([slot, itemId]) => ({
      slot,
      itemId,
    }));
    const payload = JSON.stringify({ type: "equipment", items: itemsArray });
    // Logger.system(`[EQUIPMENT] Enviando: ${payload}`); // ← LOG
    ws.send(payload);
  }

  public static getInstance(): WebSocketServer {
    return WebSocketServer.instance;
  }
}
