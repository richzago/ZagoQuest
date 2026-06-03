/**
 * world.ts
 *
 * Classe central que representa o mundo do jogo.
 * Armazena todas as entidades (players, monsters, npcs, itens, corpos),
 * os tiles do mapa, e fornece métodos para consulta e modificação.
 *
 * Responsabilidades:
 * - Gerenciar as listas de entidades (adição, remoção, busca)
 * - Gerenciar os tiles (geração inicial, acesso seguro)
 * - Fornecer métodos para detecção de colisão (isPositionOccupied)
 * - Buscar jogadores em alcance (para AI de monstros)
 * - Limpar monstros mortos periodicamente
 * - Fornecer lista de todas as entidades para o renderizador
 *
 * @module game/world/World
 */

import { Player } from "../entities/player";
import { Npc } from "../entities/npc";
import { Tile } from "./tile";
import { Monster } from "../entities/monster";
import { Logger } from "../core/logger/logger";
import { SpawnSystem } from "../systems/spawnSystem";
import { ItemEntity } from "../entities/item";
import { Corpse } from "../entities/corpse";
import { Damageable } from "../../shared/interfaces/damageable.interface";

/**
 * Representa o mundo do jogo, contendo todas as entidades, tiles e sistemas auxiliares.
 *
 * @remarks
 * O mundo é responsável por:
 * - Armazenar jogadores, monstros, NPCs, itens e corpos.
 * - Gerenciar o mapa (tiles) e gerar um mapa procedural temporário.
 * - Fornecer métodos de busca de entidades por posição e alcance.
 * - Verificar colisões (posição ocupada).
 * - Limpar monstros mortos periodicamente.
 *
 * O sistema de spawn é referenciado aqui para notificar quando um monstro morre.
 * A geração do mapa é temporária e será substituída pelo carregamento de JSON do Tiled.
 *
 * @example
 * ```typescript
 * const world = new World();
 * world.generateMap(20, 10);
 * const player = new Player(1, "Hero", 2, 2);
 * world.addPlayer(player);
 * ```
 */
export class World {
  // =========================
  // PROPRIEDADES PÚBLICAS
  // =========================

  /** Referência ao sistema de spawn (para notificar quando monstro morrer) */
  public spawnSystem?: SpawnSystem;

  /** Largura do mundo em tiles */
  width = 0;

  /** Altura do mundo em tiles */
  height = 0;

  /** Lista de jogadores ativos no mundo */
  players: Player[] = [];

  /** Lista de monstros vivos no mundo */
  monsters: Monster[] = [];

  /** Lista de NPCs no mundo */
  npcs: Npc[] = [];

  /** Mapa de tiles, onde a chave é "x,y" */
  tiles: Map<string, Tile> = new Map();

  /** Itens soltos no chão (não usado atualmente) */
  items: ItemEntity[] = [];

  /** Corpos de monstros mortos (contêm loot) */
  corpses: Corpse[] = [];

  // =========================
  // ADIÇÃO DE ENTIDADES
  // =========================

  /**
   * Adiciona um jogador ao mundo.
   * @param player - Jogador a ser adicionado
   */
  addPlayer(player: Player) {
    this.players.push(player);
    Logger.world(`Player adicionado: ${player.name} (${player.id})`);
  }

  /**
   * Adiciona um monstro ao mundo.
   * @param monster - Monstro a ser adicionado
   */
  addMonster(monster: Monster) {
    this.monsters.push(monster);
    Logger.world(`Monster spawn: ${monster.name} em ${monster.position.x},${monster.position.y}`);
  }

  /**
   * Adiciona um NPC ao mundo.
   * @param npc - NPC a ser adicionado
   */
  addNpc(npc: Npc) {
    this.npcs.push(npc);
    Logger.world(`NPC spawn: ${npc.name} em ${npc.position.x},${npc.position.y}`);
  }

  /**
   * Adiciona um item solto no chão.
   * @param item - Item a ser adicionado
   */
  addItem(item: ItemEntity): void {
    this.items.push(item);
  }

  /**
   * Remove um item solto no chão.
   * @param item - Item a ser removido
   */
  removeItem(item: ItemEntity): void {
    const idx = this.items.findIndex((i) => i.id === item.id);
    if (idx !== -1) this.items.splice(idx, 1);
  }

  /**
   * Retorna um item na posição (x, y), se existir.
   * @param x - Coordenada X
   * @param y - Coordenada Y
   * @returns O item encontrado ou `undefined`
   */
  getItemAt(x: number, y: number): ItemEntity | undefined {
    return this.items.find((i) => i.position.x === x && i.position.y === y);
  }

  /**
   * Adiciona um corpo de monstro morto ao mundo.
   * @param corpse - Corpo a ser adicionado
   */
  addCorpse(corpse: Corpse): void {
    this.corpses.push(corpse);
  }

  /**
   * Remove um corpo do mundo.
   * @param corpse - Corpo a ser removido
   */
  removeCorpse(corpse: Corpse): void {
    const index = this.corpses.findIndex((c) => c.id === corpse.id);
    if (index !== -1) this.corpses.splice(index, 1);
  }

  /**
   * Retorna um corpo na posição (x, y), se existir.
   * @param x - Coordenada X
   * @param y - Coordenada Y
   * @returns O corpo encontrado ou `undefined`
   */
  getCorpseAt(x: number, y: number): Corpse | undefined {
    return this.corpses.find((c) => c.x === x && c.y === y);
  }

  // =========================
  // GERAÇÃO DO MAPA (procedural temporário, será substituído pelo Tiled)
  // =========================

  /**
   * Gera um mapa simples de tiles caminháveis, com uma parede de teste em (5,5).
   * Futuramente será substituído por carregamento de JSON do Tiled.
   *
   * @param width - Largura do mapa (número de tiles)
   * @param height - Altura do mapa
   * @returns {void}
   *
   * @example
   * ```typescript
   * world.generateMap(20, 10);
   * ```
   */
  generateMap(width: number, height: number) {
    this.width = width;
    this.height = height;

    // Cria todos os tiles como caminháveis
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const key = `${x},${y}`;
        this.tiles.set(key, new Tile(x, y, true));
      }
    }

    // Exemplo: parede no centro (não caminhável)
    const wall = this.tiles.get("5,5");
    if (wall) wall.walkable = false;

    Logger.world(`Mapa gerado ${width}x${height} com ${this.tiles.size} tiles`);
  }

  // =========================
  // ACESSO SEGURO A TILES
  // =========================

  /**
   * Retorna o tile nas coordenadas (x, y), ou undefined se estiver fora dos limites.
   *
   * @param x - Coordenada X
   * @param y - Coordenada Y
   * @returns O tile encontrado ou `undefined`
   *
   * @example
   * ```typescript
   * const tile = world.getTile(player.position.x, player.position.y);
   * if (tile && !tile.walkable) {
   *   console.log("Você está em um obstáculo!");
   * }
   * ```
   */
  getTile(x: number, y: number): Tile | undefined {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return undefined;
    }
    return this.tiles.get(`${x},${y}`);
  }

  // =========================
  // BUSCA DE ENTIDADES POR POSIÇÃO
  // =========================

  /**
   * Retorna a primeira entidade (Player, Monster, Npc) na posição (x, y).
   * Útil para colisão e interações.
   *
   * @param x - Coordenada X
   * @param y - Coordenada Y
   * @returns A entidade encontrada ou `undefined`
   */
  getEntityAt(x: number, y: number) {
    const allEntities = [...this.players, ...this.monsters, ...this.npcs];
    return allEntities.find((entity) => entity.position.x === x && entity.position.y === y);
  }

  /**
   * Retorna um monstro vivo na posição (x, y).
   *
   * @param x - Coordenada X
   * @param y - Coordenada Y
   * @returns O monstro encontrado ou `undefined`
   */
  getMonsterAt(x: number, y: number): Monster | undefined {
    return this.monsters.find(
      (monster) => monster.position.x === x && monster.position.y === y && monster.hp > 0,
    );
  }

  /**
   * Retorna um NPC na posição (x, y).
   *
   * @param x - Coordenada X
   * @param y - Coordenada Y
   * @returns O NPC encontrado ou `undefined`
   */
  getNpcAt(x: number, y: number): Npc | undefined {
    return this.npcs.find((npc) => npc.position.x === x && npc.position.y === y);
  }

  // =========================
  // BUSCA DE JOGADORES EM ALCANCE (para IA de monstros)
  // =========================

  /**
   * Retorna todos os jogadores (Damageable) dentro de um raio de Manhattan (distância |dx|+|dy|).
   * Usado pelos monstros para encontrar alvos (aggro).
   *
   * @param x - Coordenada X do centro (normalmente do monstro)
   * @param y - Coordenada Y do centro
   * @param range - Alcance (distância máxima em Manhattan)
   * @returns Array de jogadores dentro do alcance
   *
   * @example
   * ```typescript
   * const nearbyPlayers = world.getPlayersInRange(monster.position.x, monster.position.y, 6);
   * if (nearbyPlayers.length > 0) {
   *   monster.target = nearbyPlayers[0];
   * }
   * ```
   */
  getPlayersInRange(x: number, y: number, range: number): Damageable[] {
    return this.players.filter((player) => {
      const dx = player.position.x - x;
      const dy = player.position.y - y;
      const distance = Math.abs(dx) + Math.abs(dy);
      return distance <= range;
    });
  }

  // =========================
  // COLISÃO
  // =========================

  /**
   * Verifica se uma posição (x, y) está ocupada por alguma entidade (player, monster, npc).
   *
   * @param x - Coordenada X
   * @param y - Coordenada Y
   * @param ignoredEntityId - ID de uma entidade a ser ignorada (ex: o próprio jogador ao se mover)
   * @returns `true` se a posição está ocupada, `false` caso contrário
   *
   * @example
   * ```typescript
   * if (!world.isPositionOccupied(newX, newY, player.id)) {
   *   player.position = { x: newX, y: newY };
   * }
   * ```
   */
  isPositionOccupied(x: number, y: number, ignoredEntityId?: number): boolean {
    const allEntities = [...this.players, ...this.monsters, ...this.npcs];
    return allEntities.some((entity) => {
      if (entity.id === ignoredEntityId) return false;
      return entity.position.x === x && entity.position.y === y;
    });
  }

  // =========================
  // LIMPEZA DE MONSTROS MORTOS
  // =========================

  /**
   * Remove da lista de monstros aqueles com HP <= 0 (mortos).
   * Deve ser chamado periodicamente (a cada 1.5s no game loop).
   * Os corpos já foram criados pelo DeathSystem, então apenas removemos a entidade viva.
   *
   * @returns {void}
   *
   * @example
   * ```typescript
   * // Chamado a cada intervalo no game loop
   * setInterval(() => world.cleanupDeadMonsters(), 1500);
   * ```
   */
  cleanupDeadMonsters(): void {
    const before = this.monsters.length;
    this.monsters = this.monsters.filter((m) => m.hp > 0);
    if (before !== this.monsters.length) {
      Logger.world(`Removidos ${before - this.monsters.length} monstros mortos.`);
    }
  }

  // =========================
  // SUPORTE AO RENDERIZADOR ASCII
  // =========================

  /**
   * Retorna uma lista com todas as entidades que devem ser renderizadas (players, monsters, npcs).
   * Itens e corpos não são renderizados no ASCII (apenas no futuro cliente).
   *
   * @returns Array contendo jogadores, monstros e NPCs
   *
   * @example
   * ```typescript
   * const allEntities = world.getEntities();
   * allEntities.forEach(entity => console.log(entity.name, entity.symbol));
   * ```
   */
  getEntities(): (Player | Monster | Npc)[] {
    return [...this.players, ...this.monsters, ...this.npcs];
  }
}
