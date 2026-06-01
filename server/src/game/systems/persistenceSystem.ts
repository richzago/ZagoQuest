/**
 * persistenceSystem.ts
 * Gerencia o salvamento e carregamento de dados do jogador em arquivos JSON.
 * Os saves são armazenados em data/players/<nome>.json
 */

import fs from "fs";
import path from "path";
import { Player } from "../entities/player";
import { Logger } from "../core/logger/logger";
import { PlayerSaveData } from "../../shared/interfaces/playerSave.interface";

/**
 * Estrutura de dados que será salva no arquivo JSON.
 */

export class PersistenceSystem {
  // Diretório onde os saves serão armazenados (relativo ao arquivo atual)
  private static readonly SAVE_DIR = path.join(__dirname, "../../../data/players");

  /**
   * Garante que o diretório de saves existe. Se não existir, cria recursivamente.
   */
  private static ensureDir(): void {
    if (!fs.existsSync(this.SAVE_DIR)) {
      fs.mkdirSync(this.SAVE_DIR, { recursive: true });
      Logger.system(`Diretório de saves criado: ${this.SAVE_DIR}`);
    }
  }

  /**
   * Carrega os dados de um jogador a partir do arquivo JSON.
   * @param name Nome do jogador
   * @returns Dados salvos ou null se não encontrado
   */
  static async loadPlayer(name: string): Promise<PlayerSaveData | null> {
    this.ensureDir();
    const filePath = path.join(this.SAVE_DIR, `${name}.json`);
    try {
      const data = await fs.promises.readFile(filePath, "utf-8");
      return JSON.parse(data);
    } catch (err: any) {
      if (err.code === "ENOENT") return null; // arquivo não existe
      Logger.error(`Erro ao carregar ${name}: ${err.message}`);
      return null;
    }
  }

  /**
   * Salva os dados do jogador de forma assíncrona.
   * @param player Instância do jogador
   */
  static async savePlayer(player: Player): Promise<void> {
    this.ensureDir();
    const data: PlayerSaveData = {
      id: player.id,
      name: player.name,
      level: player.level,
      xp: player.xp,
      hp: player.hp,
      maxHp: player.maxHp,
      mana: player.mana,
      maxMana: player.maxMana,
      position: { x: player.position.x, y: player.position.y },
      inventory: Object.fromEntries(player.inventory),
      equipment: Object.fromEntries(player.equipment),
      skills: Object.fromEntries(Array.from(player.skills.entries()).map(([k, v]) => [k, v])),
      gold: player.gold,
      bankGold: player.bankGold,
    };
    const filePath = path.join(this.SAVE_DIR, `${player.name}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
    Logger.system(`Jogador ${player.name} salvo.`);
  }

  /**
   * Versão síncrona do save, útil para callbacks de encerramento (tecla 'x', SIGINT).
   */
  static savePlayerSync(player: Player): void {
    this.ensureDir();
    const data: PlayerSaveData = {
      id: player.id,
      name: player.name,
      level: player.level,
      xp: player.xp,
      hp: player.hp,
      maxHp: player.maxHp,
      mana: player.mana,
      maxMana: player.maxMana,
      position: { x: player.position.x, y: player.position.y },
      inventory: Object.fromEntries(player.inventory),
      equipment: Object.fromEntries(player.equipment),
      skills: Object.fromEntries(Array.from(player.skills.entries()).map(([k, v]) => [k, v])),
      gold: player.gold,
      bankGold: player.bankGold,
    };
    const filePath = path.join(this.SAVE_DIR, `${player.name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    Logger.system(`[SYNC] Jogador ${player.name} salvo.`);
  }
}
