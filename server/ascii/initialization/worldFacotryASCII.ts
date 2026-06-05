// /**
//  * worldFactoryASCII.ts
//  *
//  * Fábrica legada que cria o mundo e o jogador **com suporte ao sistema de respawn ASCII**.
//  * Mantida apenas para compatibilidade com testes antigos e referência.
//  *
//  * ⚠️ **ATENÇÃO:** Este arquivo não deve ser usado na versão final do servidor (headless + WebSocket).
//  * Utilize `worldFactory.ts` (Tiled puro) em produção.
//  *
//  * @module ascii/initialization/worldFactoryASCII
//  */

// import { World } from "../../world/World";
// import { Player } from "../../entities/player";
// import { Logger } from "../../core/logger/logger";
// import { SpawnSystem } from "../systems/spawnSystem"; // legado, movido para ascii/systems/
// import spawnsData from "../../../data/spawns/mapSpawn.json"; // JSON antigo de pontos de spawn
// import { MapLoader } from "../../loaders/mapLoader";
// import { join } from "path";
// import { MonsterLoader } from "../../loaders/monsterLoader";
// import { PlayerLoader } from "../../loaders/playerLoader";
// import { NpcLoader } from "../../loaders/npcLoader";

// /**
//  * Cria o mundo e o jogador **com suporte ao sistema de respawn ASCII**.
//  *
//  * @param playerName - Nome do personagem a ser carregado/criado.
//  * @returns Uma promise com o mundo e o jogador instanciados.
//  *
//  * @remarks
//  * **Diferenças em relação à versão headless:**
//  * - Após carregar o mapa Tiled (ou fallback procedural), configura o `SpawnSystem` com os pontos do `mapSpawn.json`.
//  * - Esse sistema permite respawn automático de monstros (comportamento legado).
//  * - O `SpawnSystem` é armazenado no mundo (`world.spawnSystem`) para ser notificado quando monstros morrem.
//  *
//  * **Nota:** Recomenda-se migrar gradualmente para o sistema baseado em eventos, removendo esta dependência.
//  *
//  * @example
//  * ```typescript
//  * // Para testes locais (não usar em produção)
//  * const { world, player } = await createWorldAndPlayerASCII("Richard");
//  * ```
//  */
// export async function createWorldAndPlayerASCII(
//   playerName: string,
// ): Promise<{ world: World; player: Player }> {
//   // =========================
//   // 1. Criar mundo vazio
//   // =========================
//   const world = new World();

//   const mapPath = join(process.cwd(), "..", "assets", "maps", "test-map.json");
//   let playerSpawn = { x: 2, y: 2 };

//   try {
//     // =========================
//     // 2. Carregar mapa do Tiled
//     // =========================
//     const mapResult = MapLoader.loadMap(world, mapPath);
//     Logger.world(`Mapa carregado do Tiled: ${mapPath}`);

//     if (mapResult.playerSpawn) {
//       playerSpawn = mapResult.playerSpawn;
//     }

//     if (mapResult.monsters.length > 0) {
//       MonsterLoader.spawnMonsters(world, mapResult.monsters);
//     }

//     if (mapResult.npcs && mapResult.npcs.length > 0) {
//       NpcLoader.loadNpcsFromTiled(world, mapResult.npcs);
//     }
//   } catch (err: any) {
//     // =====================================================
//     // FALLBACK: Mapa procedural (completo)
//     // =====================================================
//     Logger.warn(
//       `Não foi possível carregar o mapa Tiled (${mapPath}): ${err.message}. Usando mapa procedural.`,
//     );
//     world.generateMap(20, 10);
//     // Nota: No mapa procedural, não há spawn definido para monstros via Tiled.
//     // O SpawnSystem será configurado com os pontos do JSON.
//   }

//   // =========================
//   // 3. Configurar sistema de respawn legado (SpawnSystem)
//   // =========================
//   const spawnSystem = new SpawnSystem(world);
//   world.spawnSystem = spawnSystem;
//   spawnSystem.loadSpawnPoints(spawnsData);
//   Logger.world(`Sistema de respawn configurado com ${spawnsData.length} pontos.`);

//   // =========================
//   // 4. Carregar ou criar jogador
//   // =========================
//   const player = await PlayerLoader.loadOrCreatePlayer(playerName, playerSpawn);

//   // =========================
//   // 5. Adicionar jogador ao mundo
//   // =========================
//   world.addPlayer(player);
//   Logger.world(
//     `Player spawn: ${player.name} na posição (${player.position.x}, ${player.position.y})`,
//   );

//   return { world, player };
// }
