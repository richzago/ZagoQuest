/**
 * databasePersistence.ts
 *
 * Gerencia o salvamento e carregamento de dados do jogador no PostgreSQL.
 * Substitui o antigo PersistenceSystem baseado em JSON.
 *
 * @module game/systems/DatabasePersistence
 */

import { AppDataSource } from "../../api/data-source";
import { Character } from "../../api/entities/Character";
import { Player } from "../entities/player";
import { EquipmentSlot } from "../../shared/enums/equipmentSlot.enum";
import { SkillType } from "../../shared/enums/skillType.enum";
import { SkillState } from "../../shared/interfaces/playerSave.interface";

export class DatabasePersistence {
  private static characterRepo = AppDataSource.getRepository(Character);
  private static nextPlayerId = 1000; // IDs sequenciais para runtime

  /**
   * Carrega um personagem do banco de dados e retorna uma instância de Player.
   * @param characterName - Nome do personagem
   * @returns Player restaurado ou null se não encontrado
   */
  static async loadCharacter(characterName: string): Promise<Player | null> {
    const character = await this.characterRepo.findOne({ where: { name: characterName } });
    if (!character) return null;

    // Cria jogador com ID sequencial (não usa UUID do banco)
    const player = new Player(this.nextPlayerId++, character.name, character.posX, character.posY);
    player.level = character.level;
    player.experience = character.xp;
    player.hp = character.hp;
    player.maxHp = character.maxHp;
    player.mana = character.mana;
    player.maxMana = character.maxMana;
    player.gold = character.gold;
    player.bankGold = character.bankGold;
    player.gender = character.gender;
    player.world = character.world;

    // Restaura inventário
    player.inventory.clear();
    for (const [itemId, qty] of Object.entries(character.inventory)) {
      player.inventory.set(itemId, qty);
    }

    // Restaura equipamentos
    player.equipment.clear();
    for (const [slot, itemId] of Object.entries(character.equipment)) {
      player.equipment.set(slot as EquipmentSlot, itemId);
    }

    // Restaura skills
    player.skills.clear();
    for (const [skillKey, skillState] of Object.entries(character.skills)) {
      player.skills.set(skillKey as SkillType, skillState as SkillState);
    }

    player.recalculateStats();
    return player;
  }

  /**
   * Salva o estado atual do jogador no banco de dados.
   * @param player - Instância do jogador
   */
  static async saveCharacter(player: Player): Promise<void> {
    // Busca a entidade pelo nome (não pelo ID)
    let character = await this.characterRepo.findOne({ where: { name: player.name } });
    if (!character) {
      character = this.characterRepo.create();
      character.name = player.name;
    }

    // Atualiza campos
    character.level = player.level;
    character.xp = player.experience;
    character.hp = player.hp;
    character.maxHp = player.maxHp;
    character.mana = player.mana;
    character.maxMana = player.maxMana;
    character.gold = player.gold;
    character.bankGold = player.bankGold;
    character.gender = player.gender;
    character.world = player.world;
    character.posX = player.position.x;
    character.posY = player.position.y;

    // Serializa Map para objeto
    character.inventory = Object.fromEntries(player.inventory);
    character.equipment = Object.fromEntries(player.equipment);
    character.skills = Object.fromEntries(
      Array.from(player.skills.entries()).map(([k, v]) => [k, v]),
    );

    await this.characterRepo.save(character);
  }
}
