/**
 * worldFactory.ts
 *
 * Fábrica que cria o mundo (World) e o jogador (Player).
 * Responsável por:
 * - Instanciar o World, carregar o mapa (via Tiled) ou gerar proceduralmente
 * - Configurar o sistema de spawn de monstros
 * - Carregar ou criar o jogador a partir do banco de dados (PostgreSQL)
 * - Restaurar inventário, equipamentos, skills (via DatabasePersistence)
 * - Atualizar lastSeen no sistema de guildas
 *
 * NOTA: Não carrega NPCs, não inicia loops, não agenda tarefas.
 *
 * @module game/initialization/worldFactory
 */

import { World } from "../world/World";
import { Player } from "../entities/player";
import { Logger } from "../core/logger/logger";
import { SpawnSystem } from "../systems/spawnSystem";
import spawnsData from "../../data/spawns/mapSpawn.json";
import { GuildService } from "../../api/services/guildService";
import { DatabasePersistence } from "../systems/databasePersistence";
import { MapLoader } from "../loaders/mapLoader";
import { join } from "path";

/**
 * Cria o mundo e o jogador (ou carrega um existente).
 *
 * @param playerName - Nome do personagem a ser carregado/criado
 * @returns Uma promise com um objeto contendo o `world` e o `player` instanciados
 *
 * @remarks
 * Esta fábrica é usada pelo `gameStarter` para inicializar o jogo.
 * Passos internos:
 * 1. Tenta carregar o mapa do Tiled (JSON). Se falhar, gera um mapa procedural.
 * 2. Configura o sistema de spawn de monstros.
 * 3. Carrega ou cria o jogador usando `DatabasePersistence.loadCharacter`.
 * 4. (Se novo jogador) persiste no banco imediatamente.
 * 5. Atualiza o campo `lastSeen` do jogador na guilda (se houver).
 * 6. Adiciona o jogador ao mundo.
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
  // 1. Cria o mundo e carrega o mapa (Tiled ou procedural)
  const world = new World();

  // Caminho do mapa exportado do Tiled
  const mapPath = join(process.cwd(), "assets", "maps", "zagoworld.json");
  try {
    MapLoader.loadMap(world, mapPath);
    Logger.world(`Mapa carregado do Tiled: ${mapPath}`);
  } catch (err: any) {
    Logger.warn(
      `Não foi possível carregar o mapa de ${mapPath}: ${err.message}. Usando mapa procedural.`,
    );
    world.generateMap(20, 10);
  }

  // 2. Configura o sistema de spawn de monstros
  const spawnSystem = new SpawnSystem(world);
  world.spawnSystem = spawnSystem;
  spawnSystem.loadSpawnPoints(spawnsData);

  // 3. Carrega ou cria o jogador a partir do banco de dados
  let player = await DatabasePersistence.loadCharacter(playerName);
  if (!player) {
    // Cria um novo jogador com valores padrão
    player = new Player(1, playerName, 2, 2);
    // Persiste o novo jogador no banco imediatamente
    await DatabasePersistence.saveCharacter(player);
    Logger.system(`Novo jogador ${player.name} criado e salvo no banco.`);
  } else {
    Logger.system(`Jogador ${player.name} carregado do banco de dados.`);
  }

  // 4. Atualiza lastSeen no sistema de guildas (para controle de inatividade)
  await GuildService.updateLastSeen(player.name);

  // 5. Adiciona o jogador ao mundo
  world.addPlayer(player);
  Logger.world(
    `Player spawn: ${player.name} na posição (${player.position.x}, ${player.position.y})`,
  );

  return { world, player };
}
