// /**
//  * WorldASCII.ts
//  *
//  * Versão legada da classe World, que mantém referência ao sistema de spawn/respawn
//  * baseado em JSON (SpawnSystem). Utilizada apenas para compatibilidade com testes
//  * antigos e ambiente ASCII.
//  *
//  * ⚠️ **ATENÇÃO:** Este arquivo não deve ser usado na versão final do servidor headless.
//  * Ele será movido para a pasta `ascii/world/`.
//  *
//  * @module ascii/world/WorldASCII
//  */

// import { Player } from "../../entities/player";
// import { Npc } from "../../entities/npc";
// import { Tile } from "../../world/tile";
// import { Monster } from "../../entities/monster";
// import { Logger } from "../../core/logger/logger";
// import { SpawnSystem } from "../systems/spawnSystemASCII";
// import { ItemEntity } from "../../entities/item";
// import { Corpse } from "../../entities/corpse";
// import { Damageable } from "../../../shared/interfaces/damageable.interface";

// /**
//  * Representa o mundo do jogo na versão legada (com suporte a SpawnSystem).
//  *
//  * @remarks
//  * Além das responsabilidades comuns (entidades, tiles, colisão), esta versão
//  * mantém uma referência ao `SpawnSystem` para notificar quando monstros morrem
//  * e permitir respawn automático.
//  *
//  * A geração de mapa procedural (fallback) também está presente.
//  */
// export class WorldASCII {
//   // =========================
//   // PROPRIEDADES PÚBLICAS
//   // =========================

//   /** Referência ao sistema de spawn (para notificar quando monstro morrer) */
//   public spawnSystem?: SpawnSystem;

//   /** Largura do mundo em tiles */
//   width = 0;

//   /** Altura do mundo em tiles */
//   height = 0;

//   /** Lista de jogadores ativos no mundo */
//   players: Player[] = [];

//   /** Lista de monstros vivos no mundo */
//   monsters: Monster[] = [];

//   /** Lista de NPCs no mundo */
//   npcs: Npc[] = [];

//   /** Mapa de tiles, onde a chave é "x,y" */
//   tiles: Map<string, Tile> = new Map();

//   /** Itens soltos no chão (não usado atualmente) */
//   items: ItemEntity[] = [];

//   /** Corpos de monstros mortos (contêm loot) */
//   corpses: Corpse[] = [];

//   // =========================
//   // ADIÇÃO DE ENTIDADES
//   // =========================

//   addPlayer(player: Player) {
//     this.players.push(player);
//     Logger.world(`Player adicionado: ${player.name} (${player.id})`);
//   }

//   addMonster(monster: Monster) {
//     this.monsters.push(monster);
//     Logger.world(`Monster spawn: ${monster.name} em ${monster.position.x},${monster.position.y}`);
//   }

//   addNpc(npc: Npc) {
//     this.npcs.push(npc);
//     Logger.world(`NPC spawn: ${npc.name} em ${npc.position.x},${npc.position.y}`);
//   }

//   addItem(item: ItemEntity): void {
//     this.items.push(item);
//   }

//   removeItem(item: ItemEntity): void {
//     const idx = this.items.findIndex((i) => i.id === item.id);
//     if (idx !== -1) this.items.splice(idx, 1);
//   }

//   getItemAt(x: number, y: number): ItemEntity | undefined {
//     return this.items.find((i) => i.position.x === x && i.position.y === y);
//   }

//   addCorpse(corpse: Corpse): void {
//     this.corpses.push(corpse);
//   }

//   removeCorpse(corpse: Corpse): void {
//     const index = this.corpses.findIndex((c) => c.id === corpse.id);
//     if (index !== -1) this.corpses.splice(index, 1);
//   }

//   getCorpseAt(x: number, y: number): Corpse | undefined {
//     return this.corpses.find((c) => c.x === x && c.y === y);
//   }

//   // =========================
//   // GERAÇÃO DO MAPA (procedural de fallback)
//   // =========================

//   generateMap(width: number, height: number) {
//     this.width = width;
//     this.height = height;

//     for (let x = 0; x < width; x++) {
//       for (let y = 0; y < height; y++) {
//         const key = `${x},${y}`;
//         this.tiles.set(key, new Tile(x, y, true));
//       }
//     }

//     const wall = this.tiles.get("5,5");
//     if (wall) wall.walkable = false;

//     Logger.world(`Mapa gerado ${width}x${height} com ${this.tiles.size} tiles`);
//   }

//   // =========================
//   // ACESSO SEGURO A TILES
//   // =========================

//   getTile(x: number, y: number): Tile | undefined {
//     if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
//       return undefined;
//     }
//     return this.tiles.get(`${x},${y}`);
//   }

//   // =========================
//   // BUSCA DE ENTIDADES POR POSIÇÃO
//   // =========================

//   getEntityAt(x: number, y: number) {
//     const allEntities = [...this.players, ...this.monsters, ...this.npcs];
//     return allEntities.find((entity) => entity.position.x === x && entity.position.y === y);
//   }

//   getMonsterAt(x: number, y: number): Monster | undefined {
//     return this.monsters.find(
//       (monster) => monster.position.x === x && monster.position.y === y && monster.hp > 0,
//     );
//   }

//   getNpcAt(x: number, y: number): Npc | undefined {
//     return this.npcs.find((npc) => npc.position.x === x && npc.position.y === y);
//   }

//   // =========================
//   // BUSCA DE JOGADORES EM ALCANCE
//   // =========================

//   getPlayersInRange(x: number, y: number, range: number): Damageable[] {
//     return this.players.filter((player) => {
//       const dx = player.position.x - x;
//       const dy = player.position.y - y;
//       const distance = Math.abs(dx) + Math.abs(dy);
//       return distance <= range;
//     });
//   }

//   // =========================
//   // COLISÃO
//   // =========================

//   isPositionOccupied(x: number, y: number, ignoredEntityId?: number): boolean {
//     const allEntities = [...this.players, ...this.monsters, ...this.npcs];
//     return allEntities.some((entity) => {
//       if (entity.id === ignoredEntityId) return false;
//       return entity.position.x === x && entity.position.y === y;
//     });
//   }

//   // =========================
//   // LIMPEZA DE MONSTROS MORTOS
//   // =========================

//   cleanupDeadMonsters(): void {
//     const before = this.monsters.length;
//     this.monsters = this.monsters.filter((m) => m.hp > 0);
//     if (before !== this.monsters.length) {
//       Logger.world(`Removidos ${before - this.monsters.length} monstros mortos.`);
//     }
//   }

//   // =========================
//   // SUPORTE AO RENDERIZADOR ASCII
//   // =========================

//   /**
//    * Retorna uma lista com todas as entidades que devem ser renderizadas (players, monsters, npcs).
//    * Utilizado pelo AsciiRenderer.
//    */
//   getEntities(): (Player | Monster | Npc)[] {
//     return [...this.players, ...this.monsters, ...this.npcs];
//   }
// }
