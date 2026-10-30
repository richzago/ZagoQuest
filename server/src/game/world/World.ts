/**
 * world.ts
 *
 * Classe central que representa o mundo do jogo (versão headless, sem dependências ASCII).
 * Armazena todas as entidades (players, monsters, npcs, itens, corpos),
 * os tiles do mapa, e fornece métodos para consulta e modificação.
 *
 * Responsabilidades:
 * - Gerenciar as listas de entidades (adição, remoção, busca)
 * - Gerenciar os tiles (carregados do Tiled ou gerados proceduralmente)
 * - Fornecer métodos para detecção de colisão (isPositionOccupied)
 * - Buscar jogadores em alcance (para IA de monstros)
 * - Limpar monstros mortos periodicamente
 *
 * O respawn é coordenado pelo DeathSystem usando os spawn points carregados do Tiled.
 *
 * @module game/world/World
 */

import { Player } from "../entities/player";
import { Npc } from "../entities/npc";
import { Tile } from "./tile";
import { Monster } from "../entities/monster";
import { Logger } from "../core/logger/logger";
import { ItemEntity } from "../entities/item";
import { Corpse } from "../entities/corpse";
import { Damageable } from "../../shared/interfaces/damageable.interface";
import { MonsterSpawnData } from "../../shared/interfaces/spawn.interface";
import { ItemOnGround } from "../entities/itemOnGround";
import { CombatSystem } from "../combat/combatSystem";

/**
 * Representa o mundo do jogo, contendo todas as entidades, tiles e sistemas auxiliares.
 *
 * @remarks
 * O mundo é responsável por:
 * - Armazenar jogadores, monstros, NPCs, itens e corpos.
 * - Gerenciar o mapa (tiles) e gerar um mapa procedural temporário (fallback).
 * - Fornecer métodos de busca de entidades por posição e alcance.
 * - Verificar colisões (posição ocupada).
 * - Limpar monstros mortos periodicamente.
 *
 * MonsterLoader cria os spawns iniciais e DeathSystem agenda o respawn.
 *
 * @example
 * ```typescript
 * const world = new World();
 * world.generateMap(20, 10); // fallback, mas normalmente se usa MapLoader
 * const player = new Player(1, "Hero", 2, 2);
 * world.addPlayer(player);
 * ```
 */
export class World {
  // =========================
  // PROPRIEDADES PÚBLICAS
  // =========================

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
  /** Pontos fixos do Tiled (um por objeto), referenciados pelo spawnPointId do monstro. */
  spawnPoints: MonsterSpawnData[] = [];

  public itemsOnGround: ItemOnGround[] = [];

  // =========================
  // ADIÇÃO DE ENTIDADES
  // =========================

  /**
   * Adiciona um jogador ao mundo.
   * @param player - Jogador a ser adicionado
   */
  addPlayer(player: Player): void {
    // Impede registrar o mesmo personagem duas vezes no mundo.
    if (this.players.some((existing) => existing.id === player.id)) {
      Logger.warn(`Player com ID duplicado ignorado: ${player.id}`);
      return;
    }

    player.conditionManager.bindDamage((target, amount, source, name) =>
      CombatSystem.applyPeriodicDamage(target, amount, this, source, name));
    this.players.push(player);
    Logger.world(`Player adicionado: ${player.name} (${player.id})`);
  }

  /**
   * Adiciona um monstro ao mundo.
   * @param monster - Monstro a ser adicionado
   */
  addMonster(monster: Monster): void {
    // Defesa adicional: a mesma entidade (ID) não pode entrar duas vezes.
    // Spawns distintos podem compartilhar posição, pois têm IDs diferentes.
    if (this.monsters.some((existing) => existing.id === monster.id)) {
      Logger.warn(`Monstro com ID duplicado ignorado: ${monster.id}`);
      return;
    }
    monster.conditionManager.bindDamage((target, amount, source, name) =>
      CombatSystem.applyPeriodicDamage(target, amount, this, source, name));
    this.monsters.push(monster);
    Logger.world(`Monster spawn: ${monster.name} em ${monster.position.x},${monster.position.y}`);
  }

  /**
   * Adiciona um NPC ao mundo.
   * @param npc - NPC a ser adicionado
   */
  addNpc(npc: Npc) {
    npc.conditionManager.bindDamage((target, amount, source, name) =>
      CombatSystem.applyPeriodicDamage(target, amount, this, source, name));
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
    return this.corpses.find((c) => c.position.x === x && c.position.y === y);
  }

  // =========================
  // GERAÇÃO DO MAPA (procedural de fallback)
  // =========================

  /**
   * Gera um mapa simples de tiles caminháveis, com uma parede de teste em (5,5).
   * Este método é usado apenas como fallback quando o mapa Tiled não pode ser carregado.
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
  generateMap(width: number, height: number): void {
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
        width <= 0 || height <= 0) {
      throw new Error("Dimensões do mundo devem ser inteiros positivos.");
    }
    this.width = width;
    this.height = height;
    // A second fallback map must not retain tiles or collision from the first.
    this.tiles.clear();

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
   */
  isPositionOccupied(x: number, y: number, ignoredEntityId?: string): boolean {
    const allEntities = [...this.players, ...this.monsters, ...this.npcs];
    return allEntities.some((entity) => {
      if (entity.id === ignoredEntityId) return false;
      // Monstros mortos aguardam cleanup; não devem bloquear o tile.
      if (entity instanceof Monster && entity.hp <= 0) return false;
      return entity.position.x === x && entity.position.y === y;
    });
  }

  /**
   * Verifica se uma posição (em unidades do mundo, não tiles) é caminhável.
   * Considera:
   * - Limites do mapa
   * - Tile caminhável (walkable)
   * - Ausência de entidade ocupando a posição (player, monster, npc)
   *
   * @param worldX - Coordenada X em unidades do mundo (ex: posição do jogador)
   * @param worldY - Coordenada Y em unidades do mundo
   * @param ignoredEntityId - ID da entidade a ser ignorada (ex: o próprio jogador)
   * @returns `true` se a posição é válida para movimento, `false` caso contrário.
   */
  isPositionWalkable(worldX: number, worldY: number, ignoredEntityId?: string): boolean {
    const tileX = Math.floor(worldX);
    const tileY = Math.floor(worldY);

    // 🔥 Verifica limites do mapa
    if (tileX < 0 || tileY < 0 || tileX >= this.width || tileY >= this.height) {
      return false;
    }

    const tile = this.getTile(tileX, tileY);
    if (!tile || !tile.walkable) return false;

    if (this.isPositionOccupied(tileX, tileY, ignoredEntityId)) return false;

    return true;
  }

  // =========================
  // LIMPEZA DE MONSTROS MORTOS
  // =========================

  /**
   * Remove da lista de monstros aqueles com HP <= 0 (mortos).
   * Deve ser chamado periodicamente (a cada 1.5s no game loop).
   * Os corpos já foram criados pelo DeathSystem, então apenas removemos a entidade viva.
   */
  cleanupDeadMonsters(): void {
    const before = this.monsters.length;
    this.monsters = this.monsters.filter((m) => m.hp > 0);
    if (before !== this.monsters.length) {
      Logger.world(`Removidos ${before - this.monsters.length} monstros mortos.`);
    }
  }

  /**
   * Verifica se uma coordenada está dentro dos limites do mundo (baseado em tiles).
   */
  isWithinBounds(x: number, y: number): boolean {
    return Number.isSafeInteger(x) && Number.isSafeInteger(y) &&
      x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * Remove um monstro da lista de monstros vivos.
   * @param monster - Monstro a ser removido
   */
  removeMonster(monster: Monster): void {
    const index = this.monsters.findIndex((m) => m.id === monster.id);
    if (index !== -1) {
      this.monsters.splice(index, 1);
      Logger.world(`Monstro ${monster.name} (${monster.id}) removido do mundo.`);
    }
  }

  /**
   * Adiciona um item no chão.
   */
  addItemOnGround(item: ItemOnGround): void {
    this.itemsOnGround.push(item);
    Logger.world(
      `Item ${item.itemId} x${item.amount} dropado em (${item.position.x}, ${item.position.y})`,
    );
  }

  /**
   * Remove um item do chão.
   */
  removeItemOnGround(item: ItemOnGround): void {
    const index = this.itemsOnGround.indexOf(item);
    if (index !== -1) {
      this.itemsOnGround.splice(index, 1);
      Logger.world(`Item ${item.itemId} removido do chão.`);
    }
  }

  /**
   * Busca um item no chão pelo ID.
   */
  getItemOnGround(id: string): ItemOnGround | undefined {
    return this.itemsOnGround.find((i) => i.id === id);
  }

  /**
   * Busca itens no chão em uma posição (tile).
   */
  getItemsOnGroundAt(x: number, y: number): ItemOnGround[] {
    return this.itemsOnGround.filter((i) => i.position.x === x && i.position.y === y);
  }
}
