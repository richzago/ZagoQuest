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
 * O DeathSystem gerencia respawn e cadáveres após a morte de monstros.
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
import type { MapLoadResult } from "../loaders/mapLoader";

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
 * **Nota:** o respawn dos monstros é gerenciado pelo DeathSystem.
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

  let mapResult: MapLoadResult | undefined;
  try {
    // Only map reading/parsing errors qualify for the procedural fallback.
    mapResult = MapLoader.loadMap(world, mapPath);
    Logger.world(`Mapa carregado do Tiled: ${mapPath}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    Logger.warn(
      `Não foi possível carregar o mapa Tiled (${mapPath}): ${reason}. Usando mapa procedural.`,
    );
    world.generateMap(20, 10);
    // Apenas quando não há mapa Tiled: fallback da worldFactory, não do Unity.
    world.playerRespawn = { ...playerSpawn };
  }

  if (mapResult) {
    playerSpawn = mapResult.playerSpawn ?? playerSpawn;
    // Tiled é a origem das coordenadas, World mantém apenas snapshot validado.
    const respawn = mapResult.respawnSpawn ?? playerSpawn;
    world.playerRespawn = world.getTile(respawn.x, respawn.y)?.walkable
      ? { ...respawn } : { ...playerSpawn };
    Logger.world(`Respawn do jogador definido pelo Tiled: (${world.playerRespawn.x}, ${world.playerRespawn.y})`);
    // Entity loader errors must propagate. Silently switching to the fallback
    // would hide a broken registry/NPC config and leave a partially loaded World.
    if (mapResult.monsters.length) MonsterLoader.spawnMonsters(world, mapResult.monsters);
    if (mapResult.npcs?.length) NpcLoader.loadNpcsFromTiled(world, mapResult.npcs);
  }

  // =========================
  // 3. Carregar ou criar jogador
  // =========================
  const player = await PlayerLoader.loadOrCreatePlayer(playerName, playerSpawn, world);

  // =========================
  // 4. Adicionar jogador ao mundo
  // =========================
  world.addPlayer(player);
  Logger.world(
    `Player spawn: ${player.name} na posição (${player.position.x}, ${player.position.y})`,
  );

  return { world, player };
}
