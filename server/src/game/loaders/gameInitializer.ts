/**
 * gameInitializer.ts
 * Responsável por criar o mundo e carregar/criar o jogador.
 */

import { World } from "../world/world";
import { Player } from "../entities/player";
import { PersistenceSystem } from "../systems/persistenceSystem";
import { EquipmentSlot } from "../entities/equipmentTypes";
import { SkillType } from "../../data/skills/skillTypes";
import { Logger } from "../core/logger/logger";
import { SpawnSystem } from "../systems/spawnSystem";
import spawnsData from "../../data/spawns/mapSpawn.json";

export async function initializeGame(
  playerName: string,
): Promise<{ world: World; player: Player }> {
  // Cria o mundo
  const world = new World();
  world.generateMap(20, 10);

  // Sistema de spawn (monstros)
  const spawnSystem = new SpawnSystem(world);
  world.spawnSystem = spawnSystem;
  spawnSystem.loadSpawnPoints(spawnsData);

  // Carrega ou cria o jogador
  let player: Player;
  const savedData = await PersistenceSystem.loadPlayer(playerName);

  if (savedData) {
    player = new Player(savedData.id, savedData.name, savedData.position.x, savedData.position.y);
    player.level = savedData.level;
    player.xp = savedData.xp;
    player.hp = savedData.hp;
    player.maxHp = savedData.maxHp;
    player.mana = savedData.mana;
    player.maxMana = savedData.maxMana;
    player.gold = savedData.gold ?? 0;
    player.bankGold = savedData.bankGold ?? 0;

    player.inventory.clear();
    for (const [itemId, qty] of Object.entries(savedData.inventory)) {
      player.inventory.set(itemId, qty as number);
    }

    if (savedData.equipment) {
      player.equipment.clear();
      for (const [slot, itemId] of Object.entries(savedData.equipment)) {
        player.equipment.set(slot as EquipmentSlot, itemId);
      }
      Logger.system(`Equipamentos de ${player.name} restaurados.`);
    }

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
    player = new Player(1, playerName, 2, 2);
    Logger.system(`Novo jogador ${player.name} criado.`);
  }

  world.addPlayer(player);
  Logger.world(
    `Player spawn: ${player.name} na posição (${player.position.x}, ${player.position.y})`,
  );

  return { world, player };
}
