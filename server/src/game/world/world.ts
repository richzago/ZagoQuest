import { Player } from "../entities/player";
import { Npc } from "../entities/npc";
import { Tile } from "./tile";
import { Monster } from "../entities/monster";
import { Logger } from "../core/logger/logger";
import { SpawnSystem } from "../systems/spawnSystem";
import { ItemEntity } from "../entities/item";
import { Corpse } from "../entities/corpse";
import { Damageable } from "../../shared/interfaces/damageable.interface";

export class World {
  public spawnSystem?: SpawnSystem;

  width = 0;
  height = 0;
  players: Player[] = [];
  monsters: Monster[] = [];
  npcs: Npc[] = [];
  tiles: Map<string, Tile> = new Map();
  items: ItemEntity[] = [];
  corpses: Corpse[] = [];

  // =========================
  // ADD ENTITIES
  // =========================

  addPlayer(player: Player) {
    this.players.push(player);
    Logger.world(`Player adicionado: ${player.name} (${player.id})`);
  }

  addMonster(monster: Monster) {
    this.monsters.push(monster);
    Logger.world(`Monster spawn: ${monster.name} em ${monster.position.x},${monster.position.y}`);
  }

  addNpc(npc: Npc) {
    this.npcs.push(npc);
    Logger.world(`NPC spawn: ${npc.name} em ${npc.position.x},${npc.position.y}`);
  }

  addItem(item: ItemEntity): void {
    this.items.push(item);
  }

  removeItem(item: ItemEntity): void {
    const idx = this.items.findIndex((i) => i.id === item.id);
    if (idx !== -1) this.items.splice(idx, 1);
  }

  getItemAt(x: number, y: number): ItemEntity | undefined {
    return this.items.find((i) => i.position.x === x && i.position.y === y);
  }

  addCorpse(corpse: Corpse): void {
    this.corpses.push(corpse);
  }

  removeCorpse(corpse: Corpse): void {
    const index = this.corpses.findIndex((c) => c.id === corpse.id);
    if (index !== -1) this.corpses.splice(index, 1);
  }

  getCorpseAt(x: number, y: number): Corpse | undefined {
    return this.corpses.find((c) => c.x === x && c.y === y);
  }

  // =========================
  // MAP GENERATION
  // =========================

  generateMap(width: number, height: number) {
    this.width = width;
    this.height = height;

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = `${x},${y}`;
        this.tiles.set(key, new Tile(x, y, true));
      }
    }

    // parede teste
    const wall = this.tiles.get("5,5");
    if (wall) wall.walkable = false;

    Logger.world(`Mapa gerado ${width}x${height} com ${this.tiles.size} tiles`);
  }

  // =========================
  // TILE ACCESS (SAFE)
  // =========================

  getTile(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return undefined;
    }
    return this.tiles.get(`${x},${y}`);
  }

  // =========================
  // ENTITY SYSTEM
  // =========================

  getEntityAt(x: number, y: number) {
    const allEntities = [...this.players, ...this.monsters, ...this.npcs];
    return allEntities.find((entity) => entity.position.x === x && entity.position.y === y);
  }

  // =========================
  // GET MONSTER SYSTEM
  // =========================
  getMonsterAt(x: number, y: number): Monster | undefined {
    return this.monsters.find(
      (monster) => monster.position.x === x && monster.position.y === y && monster.hp > 0,
    );
  }

  // =========================
  // NPC SEARCH
  // =========================
  getNpcAt(x: number, y: number): Npc | undefined {
    return this.npcs.find((npc) => npc.position.x === x && npc.position.y === y);
  }

  // =========================
  // PLAYER SEARCH (AGGRO)
  // =========================
  getPlayersInRange(x: number, y: number, range: number): Damageable[] {
    return this.players.filter((player) => {
      const dx = player.position.x - x;
      const dy = player.position.y - y;
      const distance = Math.abs(dx) + Math.abs(dy);
      return distance <= range;
    });
  }

  isPositionOccupied(x: number, y: number, ignoredEntityId?: number): boolean {
    const allEntities = [...this.players, ...this.monsters, ...this.npcs];
    return allEntities.some((entity) => {
      if (entity.id === ignoredEntityId) return false;
      return entity.position.x === x && entity.position.y === y;
    });
  }

  // =========================
  // CLEANUP
  // =========================
  cleanupDeadMonsters(): void {
    const before = this.monsters.length;
    this.monsters = this.monsters.filter((m) => m.hp > 0);
    if (before !== this.monsters.length) {
      Logger.world(`Removidos ${before - this.monsters.length} monstros mortos.`);
    }
  }

  // =========================
  // VIEWPORT SUPPORT
  // =========================
  getEntities(): (Player | Monster | Npc)[] {
    return [...this.players, ...this.monsters, ...this.npcs];
  }
}
