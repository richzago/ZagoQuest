/**
 * worldStateSender.ts
 *
 * Envia o estado completo do mundo (monstros, NPCs, itens no chão).
 *
 * @module network/senders
 */

import { WebSocket } from "ws";
import { World } from "../../game/world/World";
import type { Player } from "../../game/entities/player";
import { Logger } from "../../game/core/logger/logger";
import { BaseSender } from "./base/baseSender";

export class WorldStateSender extends BaseSender {
  /**
   * Envia todas as entidades do mundo para o cliente.
   */
  public sendWorldState(world: World, viewer?: Player, onlinePlayers: readonly Player[] = []): void {
    let count = 0;

    // Em modo autenticado, cada recém-chegado recebe os outros jogadores ONLINE,
    // não o próprio avatar nem personagens desconectados que ainda estão em memória.
    const peers = new Set<string>();
    for (const other of onlinePlayers) {
      if (other.id === viewer?.id || peers.has(other.id)) continue;
      peers.add(other.id);
      this.send({ type: "spawn", id: other.id, name: other.name,
        x: other.position.x, y: other.position.y, hp: other.hp, maxHp: other.maxHp });
      count++;
    }

    // Envia monstros
    for (const monster of world.monsters) {
      this.send({
        type: "spawn",
        id: monster.id,
        name: monster.name,
        x: monster.position.x,
        y: monster.position.y,
        hp: monster.hp,
        maxHp: monster.maxHp,
      });
      count++;
    }

    // Envia NPCs
    for (const npc of world.npcs) {
      this.send({
        type: "spawn",
        id: npc.id,
        name: npc.name,
        x: npc.position.x,
        y: npc.position.y,
        npcType: npc.npcType,
      });
      count++;
    }

    // Match the exact spawn format already broadcast when a monster dies.
    for (const corpse of world.corpses) {
      this.send({
        type: "spawn",
        id: corpse.id,
        name: "Corpse",
        x: corpse.position.x,
        y: corpse.position.y,
      });
      count++;
    }

    // Envia itens no chão
    for (const item of world.itemsOnGround) {
      this.send({
        type: "spawn",
        id: item.id,
        name: item.itemName,
        x: item.position.x,
        y: item.position.y,
        itemId: item.itemId,
        amount: item.amount,
        isItem: true,
      });
      count++;
    }

    Logger.world(`WorldStateSender: enviadas ${count} entidades para o cliente`);
  }

  /**
   * Método estático para uso rápido.
   */
  public static send(ws: WebSocket, world: World, viewer?: Player, onlinePlayers?: readonly Player[]): void {
    const sender = new WorldStateSender(ws);
    sender.sendWorldState(world, viewer, onlinePlayers);
  }
}
