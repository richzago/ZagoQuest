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

  /**
   * Mapa de direção para deslocamento (dx, dy) em tiles.
   */
  private directionOffsets: Record<Direction, { dx: number; dy: number }> = {
    north: { dx: 0, dy: 1 }, // norte = cima
    south: { dx: 0, dy: -1 }, // sul = baixo
    east: { dx: 1, dy: 0 },
    west: { dx: -1, dy: 0 },
    northeast: { dx: 1, dy: 1 },
    northwest: { dx: -1, dy: 1 },
    southeast: { dx: 1, dy: -1 },
    southwest: { dx: -1, dy: -1 },
  };

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
          switch (msg.type) {
            case "move":
              this.handleMove(ws, msg);
              break;
            case "chat":
              await this.handleChat(ws, msg);
              break;
            case "attack":
              await this.handleAttack(ws, msg);
              break;
            case "loot":
              await this.handleLoot(ws, msg);
              break;
            case "takeLoot":
              await this.handleTakeLoot(ws, msg);
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
            case "moveDir":
              this.handleMoveDir(ws, msg);
              break;
            case "startAutoAttack":
              this.handleStartAutoAttack(ws, msg);
              break;
            case "stopAutoAttack":
              this.handleStopAutoAttack(ws, msg);
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
  // MOVIMENTO POR DIREÇÃO (ESTILO TIBIA)
  // =========================

  /**
   * Processa um comando de movimento por direção.
   * @param ws - WebSocket do cliente.
   * @param msg - Objeto com `dir` (direção).
   */
  private handleMoveDir(ws: WebSocket, msg: { dir: Direction }): void {
    const player = this.clients.get(ws);
    if (!player) return;

    const { dir } = msg;
    const offset = this.directionOffsets[dir];
    if (!offset) {
      Logger.warn(`Direção inválida: ${dir}`);
      return;
    }

    const newX = player.position.x + offset.dx;
    const newY = player.position.y + offset.dy;

    if (this.world.isPositionWalkable(newX, newY, player.id)) {
      player.position.x = newX;
      player.position.y = newY;

      // Confirma a nova posição para o próprio cliente
      ws.send(JSON.stringify({ type: "position", x: newX, y: newY }));

      // Broadcast para outros clientes
      this.broadcastMove(player.id, newX, newY, ws);
    } else {
      // Movimento bloqueado: envia a posição atual novamente
      ws.send(JSON.stringify({ type: "position", x: player.position.x, y: player.position.y }));
    }
  }

  // =========================
  // ATAQUE AUTOMÁTICO
  // =========================

  /**
   * Inicia o ataque automático contra um alvo.
   * @param ws - WebSocket do cliente.
   * @param msg - Objeto com `targetId`.
   */
  private handleStartAutoAttack(ws: WebSocket, msg: { targetId: string }): void {
    const player = this.clients.get(ws);
    if (!player) return;

    const targetId = msg.targetId;
    const target = this.world.monsters.find((m) => m.id === targetId);
    if (!target || target.hp <= 0) {
      ws.send(JSON.stringify({ type: "autoAttackStopped", reason: "Alvo inválido ou morto" }));
      return;
    }

    // Armazena o alvo atual do jogador (supondo que Player tenha a propriedade `currentTargetId`)
    player.currentTargetId = targetId;
    Logger.combat(`${player.name} iniciou ataque automático contra ${target.name}`);
  }

  /**
   * Para o ataque automático.
   */
  private handleStopAutoAttack(ws: WebSocket, _msg: any): void {
    const player = this.clients.get(ws);
    if (!player) return;
    player.currentTargetId = undefined;
    Logger.combat(`${player.name} parou ataque automático`);
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

    for (const npc of this.world.npcs) {
      ws.send(
        JSON.stringify({
          type: "spawn",
          id: npc.id,
          name: npc.name,
          x: npc.position.x,
          y: npc.position.y,
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

  private async handleChat(ws: WebSocket, msg: { message: string }): Promise<void> {
    const player = this.clients.get(ws);
    if (!player) return;

    let { message } = msg;
    message = message.trim().toLowerCase();
    Logger.warn(`[RECEBIDO] ${player.name}: ${message}`);

    const interactionWords = ["hi", "oi", "olá", "hello", "bye", "tchau"];
    if (interactionWords.includes(message)) {
      const command = message === "bye" || message === "tchau" ? "/bye" : "/hi";
      Logger.warn(`[COMANDO NPC] ${command} de ${player.name}`);
      await processChatCommand(command, player, this.world);
      return;
    }

    if (message.startsWith("/")) {
      await processChatCommand(message, player, this.world);
    } else {
      const channel = (player as any).currentChannel || "local";
      ChatSystem.sendToChannel(player, channel, message);
      this.broadcastChat(player.name, message, channel);
    }
  }

  private async handleAttack(ws: WebSocket, msg: { targetId: string }): Promise<void> {
    const player = this.clients.get(ws);
    if (!player) return;

    const targetId = msg.targetId;
    const target = this.world.monsters.find((m) => m.id === targetId);
    if (!target) {
      Logger.warn(`Jogador ${player.name} tentou atacar monstro inexistente ${targetId}`);
      return;
    }

    CombatSystem.attack(player, target, this.world);

    if (target.hp <= 0) {
      this.broadcastDespawn(target.id);
    } else {
      this.broadcastDamage(target.id, target.hp, target.maxHp);
    }
  }

  private async handleLoot(ws: WebSocket, msg: { corpseId: string }): Promise<void> {
    const player = this.clients.get(ws);
    if (!player) return;

    const { corpseId } = msg;
    const corpse = this.world.corpses.find((c) => c.id === corpseId);
    if (!corpse) {
      Logger.warn(`Jogador ${player.name} tentou lootear corpse inexistente ${corpseId}`);
      ws.send(JSON.stringify({ type: "lootError", message: "Corpse not found" }));
      return;
    }

    const dx = Math.abs(corpse.position.x - player.position.x);
    const dy = Math.abs(corpse.position.y - player.position.y);
    if (dx + dy > 2) {
      Logger.warn(`Jogador ${player.name} muito longe do corpse ${corpseId}`);
      ws.send(JSON.stringify({ type: "lootError", message: "Too far from corpse" }));
      return;
    }

    ws.send(
      JSON.stringify({
        type: "lootWindow",
        corpseId: corpse.id,
        items: corpse.loot,
      }),
    );
    Logger.world(`Jogador ${player.name} abriu loot do corpse ${corpseId}`);
  }

  private async handleTakeLoot(
    ws: WebSocket,
    msg: { corpseId: string; takeAll: boolean; itemIndex?: number },
  ): Promise<void> {
    const player = this.clients.get(ws);
    if (!player) return;

    const corpse = this.world.corpses.find((c) => c.id === msg.corpseId);
    if (!corpse) {
      ws.send(JSON.stringify({ type: "lootError", message: "Corpse not found" }));
      return;
    }

    const dx = Math.abs(corpse.position.x - player.position.x);
    const dy = Math.abs(corpse.position.y - player.position.y);
    if (dx + dy > 2) {
      ws.send(JSON.stringify({ type: "lootError", message: "Too far from corpse" }));
      return;
    }

    if (msg.takeAll) {
      for (const item of corpse.loot) {
        player.addItem(item.itemId, item.amount);
        Logger.loot(
          `Jogador ${player.name} recebeu ${item.amount}x ${item.itemId} do corpse ${corpse.id}`,
        );
        Logger.system(
          `[INVENTORY DEBUG] Após addItem, inventário de ${player.name}: ${JSON.stringify(Array.from(player.inventory.entries()))}`,
        );
      }
      this.world.removeCorpse(corpse);
      this.broadcastDespawn(corpse.id);
      ws.send(JSON.stringify({ type: "lootTaken", corpseId: corpse.id }));
      this.sendInventory(ws, player);
    } else if (msg.itemIndex !== undefined) {
      const item = corpse.loot[msg.itemIndex];
      if (item) {
        player.addItem(item.itemId, item.amount);
        Logger.loot(
          `Jogador ${player.name} recebeu ${item.amount}x ${item.itemId} do corpse ${corpse.id}`,
        );
        Logger.system(
          `[INVENTORY DEBUG] Após addItem individual, inventário: ${JSON.stringify(Array.from(player.inventory.entries()))}`,
        );
        corpse.loot.splice(msg.itemIndex, 1);
        if (corpse.loot.length === 0) {
          this.world.removeCorpse(corpse);
          this.broadcastDespawn(corpse.id);
        }
        ws.send(
          JSON.stringify({ type: "lootTaken", corpseId: corpse.id, itemIndex: msg.itemIndex }),
        );
        this.sendInventory(ws, player);
      } else {
        ws.send(JSON.stringify({ type: "lootError", message: "Item not found" }));
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

  private async handleDropItem(
    ws: WebSocket,
    msg: { itemId: string; amount?: number },
  ): Promise<void> {
    const player = this.clients.get(ws);
    if (!player) return;

    const { itemId, amount = 1 } = msg;
    if (!player.hasItem(itemId, amount)) {
      ws.send(JSON.stringify({ type: "dropError", message: "Quantidade insuficiente." }));
      return;
    }

    player.removeItem(itemId, amount);
    this.sendInventory(ws, player);
    Logger.loot(`${player.name} descartou ${amount}x ${itemId}`);
  }

  private async handleOpenShop(ws: WebSocket, msg: { npcId: string }): Promise<void> {
    Logger.system(`[SHOP] handleOpenShop chamado com msg: ${JSON.stringify(msg)}`);
    const player = this.clients.get(ws);
    if (!player) {
      Logger.error("[SHOP] Player não encontrado");
      return;
    }
    const npcId = msg.npcId;
    Logger.system(`[SHOP] Procurando NPC com id ou nome: ${npcId}`);
    const npc = this.world.npcs.find((n) => n.id === npcId || n.name.toLowerCase() === npcId);
    if (!npc) {
      Logger.error(`[SHOP] NPC não encontrado: ${npcId}`);
      ws.send(JSON.stringify({ type: "shopError", message: "NPC não encontrado." }));
      return;
    }
    Logger.system(`[SHOP] NPC encontrado: ${npc.name}, type=${npc.npcType}`);
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

  private sendGold(ws: WebSocket, player: Player): void {
    ws.send(
      JSON.stringify({
        type: "goldUpdate",
        gold: player.gold,
        bankGold: player.bankGold,
      }),
    );
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

  private broadcastDamage(targetId: string, newHp: number, maxHp: number): void {
    const msg = JSON.stringify({ type: "damage", targetId, newHp, maxHp });
    for (const [socket] of this.clients.entries()) {
      if (socket.readyState === WebSocket.OPEN) socket.send(msg);
    }
  }

  private broadcastChat(senderName: string, message: string, channel: string = "local"): void {
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

  private broadcastDespawn(entityId: string): void {
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

  public static getInstance(): WebSocketServer {
    return WebSocketServer.instance;
  }
}
