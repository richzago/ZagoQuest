/**
 * worldFactory.ts
 *
 * Fábrica que cria o mundo (World) e o jogador (Player) **apenas com dados do Tiled**.
 * Não utiliza sistemas legados (ASCII, SpawnSystem baseado em JSON, etc.).
 *
 * Responsabilidades:
 * - Carregar o mapa via `MapLoader` (formato JSON do Tiled).
 * - Definir a posição inicial do jogador a partir da layer `PlayerSpawn`.
 * - Spawnar monstros via `MonsterLoader` (usando objetos da layer `MonsterSpawn`).
 * - Spawnar NPCs via `NpcLoader` (usando objetos da layer `NPCSpawn`).
 * - Criar ou carregar o jogador persistido via `PlayerLoader`.
 * - Adicionar o jogador ao mundo.
 *
 * **NOTA:** Não há sistema de respawn automático nesta versão. Monstros que morrem não renascem.
 * Isso pode ser adicionado futuramente como um sistema separado baseado em eventos.
 *
 * @module game/initialization/worldFactory
 */

import { World } from "../world/World";
import { Player } from "../entities/player";
import { Logger } from "../core/logger/logger";
import { MapLoader } from "../loaders/mapLoader";
import { join } from "path";
import { MonsterLoader } from "../loaders/monsterLoader";
import { PlayerLoader } from "../loaders/playerLoader";
import { NpcLoader } from "../loaders/npcLoader";

/**
 * Cria o mundo e o jogador utilizando exclusivamente dados do Tiled.
 *
 * @param playerName - Nome do personagem a ser carregado/criado.
 * @returns Uma promise com o mundo e o jogador instanciados.
 *
 * @remarks
 * **Fluxo de execução:**
 * 1. Cria um mundo vazio.
 * 2. Tenta carregar o mapa Tiled (`assets/maps/test-map.json`).
 * 3. Se o carregamento falhar (arquivo ausente ou corrompido), gera um mapa procedural de fallback **sem NPCs e sem monstros**.
 * 4. Extrai a posição de spawn do jogador da layer `PlayerSpawn` (ou usa o padrão (2,2) se não encontrado).
 * 5. Spawna monstros da layer `MonsterSpawn` (cada objeto deve ter propriedade `monsterId`).
 * 6. Spawna NPCs da layer `NPCSpawn` (cada objeto deve ter propriedade `npcId`).
 * 7. Carrega ou cria o jogador via `PlayerLoader`.
 * 8. Adiciona o jogador ao mundo.
 *
 * **Nota:** Não há sistema de respawn. Monstros mortos não renascem.
 *
 * @example
 * ```typescript
 * // No gameStarter.ts
 * const { world, player } = await createWorldAndPlayer("Richard");
 * ```
 */
export async function createWorldAndPlayer(
  playerName: string,
): Promise<{ world: World; player: Player }> {
  // =========================
  // 1. Criar mundo vazio
  // =========================
  const world = new World();

  // Caminho do mapa Tiled (assets/maps/test-map.json)
  const mapPath = join(process.cwd(), "..", "assets", "maps", "test-map.json");

  // Posição inicial padrão (fallback)
  let playerSpawn = { x: 2, y: 2 };

  try {
    // =========================
    // 2. Carregar mapa do Tiled
    // =========================
    const mapResult = MapLoader.loadMap(world, mapPath);
    Logger.world(`Mapa carregado do Tiled: ${mapPath}`);

    // Define posição do jogador se existir na layer "PlayerSpawn"
    if (mapResult.playerSpawn) {
      playerSpawn = mapResult.playerSpawn;
    }

    // Spawnar monstros (se houver objetos na layer "MonsterSpawn")
    if (mapResult.monsters.length > 0) {
      MonsterLoader.spawnMonsters(world, mapResult.monsters);
    }

    // Spawnar NPCs (se houver objetos na layer "NPCSpawn")
    if (mapResult.npcs && mapResult.npcs.length > 0) {
      NpcLoader.loadNpcsFromTiled(world, mapResult.npcs);
    }
    // Se não houver NPCs no Tiled, simplesmente não carrega nenhum.
  } catch (err: any) {
    // =====================================================
    // FALLBACK: Mapa procedural (caso o JSON do Tiled não exista)
    // =====================================================
    Logger.warn(
      `Não foi possível carregar o mapa Tiled (${mapPath}): ${err.message}. Usando mapa procedural.`,
    );
    // Gera um mundo simples 20x10, todos tiles caminháveis, exceto uma parede em (5,5)
    world.generateMap(20, 10);
    // No mapa procedural não há spawn definido para NPCs ou monstros.
  }

  // =========================
  // 3. Carregar ou criar jogador
  // =========================
  const player = await PlayerLoader.loadOrCreatePlayer(playerName, playerSpawn);

  // =========================
  // 4. Adicionar jogador ao mundo
  // =========================
  world.addPlayer(player);
  Logger.world(
    `Player spawn: ${player.name} na posição (${player.position.x}, ${player.position.y})`,
  );

  return { world, player };
}
