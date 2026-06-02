/**
 * worldFactory.ts
 *
 * Fábrica que cria o mundo (World) e o jogador (Player).
 * Responsável por:
 * - Instanciar o World, gerar o mapa (procedural ou via Tiled)
 * - Configurar o sistema de spawn de monstros
 * - Carregar ou criar o jogador a partir da persistência (JSON)
 * - Restaurar inventário, equipamentos, skills
 * - Atualizar lastSeen no sistema de guildas
 *
 * NOTA: Não carrega NPCs, não inicia loops, não agenda tarefas.
 *
 * @module game/initialization/worldFactory
 */

import { World } from "../world/World";
import { Player } from "../entities/player";
import { PersistenceSystem } from "../systems/persistenceSystem";
import { Logger } from "../core/logger/logger";
import { SpawnSystem } from "../systems/spawnSystem";
import spawnsData from "../../data/spawns/mapSpawn.json";
import { EquipmentSlot } from "../../shared/enums/equipmentSlot.enum";
import { SkillType } from "../../shared/enums/skillType.enum";
import { GuildSystem } from "../systems/guildSystem";

/**
 * Cria o mundo e o jogador (ou carrega um existente).
 *
 * @param playerName - Nome do personagem a ser carregado/criado
 * @returns Uma promise com um objeto contendo o `world` e o `player` instanciados
 *
 * @remarks
 * Esta fábrica é usada pelo `gameStarter` para inicializar o jogo.
 * Passos internos:
 * 1. Gera o mundo procedural (futuramente via Tiled)
 * 2. Configura o sistema de spawn de monstros
 * 3. Carrega ou cria o jogador usando `PersistenceSystem`
 * 4. Restaura inventário, equipamentos, skills e atributos
 * 5. Atualiza o campo `lastSeen` do jogador na guilda (se houver)
 * 6. Adiciona o jogador ao mundo
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
  // 1. Cria o mundo (com mapa procedural temporário)
  const world = new World();
  world.generateMap(20, 10);

  // 2. Configura o sistema de spawn de monstros
  const spawnSystem = new SpawnSystem(world);
  world.spawnSystem = spawnSystem;
  spawnSystem.loadSpawnPoints(spawnsData);

  // 3. Carrega ou cria o jogador
  let player: Player;
  const savedData = await PersistenceSystem.loadPlayer(playerName);

  if (savedData) {
    // Restaura dados do jogador a partir do JSON
    player = new Player(savedData.id, savedData.name, savedData.position.x, savedData.position.y);
    player.level = savedData.level;
    player.xp = savedData.xp;
    player.hp = savedData.hp;
    player.maxHp = savedData.maxHp;
    player.mana = savedData.mana;
    player.maxMana = savedData.maxMana;
    player.gold = savedData.gold ?? 0;
    player.bankGold = savedData.bankGold ?? 0;

    // Inventário
    player.inventory.clear();
    for (const [itemId, qty] of Object.entries(savedData.inventory)) {
      player.inventory.set(itemId, qty as number);
    }

    // Equipamentos
    if (savedData.equipment) {
      player.equipment.clear();
      for (const [slot, itemId] of Object.entries(savedData.equipment)) {
        player.equipment.set(slot as EquipmentSlot, itemId);
      }
      Logger.system(`Equipamentos de ${player.name} restaurados.`);
    }

    // Skills
    if (savedData.skills) {
      player.skills.clear();
      for (const [skillKey, skillState] of Object.entries(savedData.skills)) {
        player.skills.set(skillKey as SkillType, skillState as { level: number; progress: number });
      }
      Logger.system(`Skills de ${player.name} restauradas.`);
    }

    player.recalculateStats();
    Logger.system(`Jogador ${player.name} carregado com sucesso!`);
  } else {
    // Cria um novo jogador com valores padrão
    player = new Player(1, playerName, 2, 2);
    Logger.system(`Novo jogador ${player.name} criado.`);
  }

  // 4. Atualiza lastSeen no sistema de guildas (para controle de inatividade)
  GuildSystem.updateLastSeen(player.name);

  // 5. Adiciona o jogador ao mundo
  world.addPlayer(player);
  Logger.world(
    `Player spawn: ${player.name} na posição (${player.position.x}, ${player.position.y})`,
  );

  return { world, player };
}
