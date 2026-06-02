/**
 * persistenceSystem.ts
 *
 * Gerencia o salvamento e carregamento de dados do jogador em arquivos JSON.
 * Os saves são armazenados em `data/players/<nome>.json`.
 * Fornece métodos assíncronos e uma versão síncrona para encerramento.
 *
 * @module game/systems/PersistenceSystem
 */

import fs from "fs";
import path from "path";
import { Player } from "../entities/player";
import { Logger } from "../core/logger/logger";
import { PlayerSaveData } from "../../shared/interfaces/playerSave.interface";

/**
 * Sistema de persistência em JSON.
 * Responsável por salvar e restaurar o estado do jogador (inventário, equipamentos, skills, etc.).
 *
 * @remarks
 * Os dados são armazenados em arquivos individuais com o nome do jogador.
 * Em produção, pode ser substituído por um banco de dados, mas JSON é suficiente para o estágio atual.
 *
 * @example
 * ```typescript
 * // Carregar jogador
 * const data = await PersistenceSystem.loadPlayer("Richard");
 * // Salvar jogador
 * await PersistenceSystem.savePlayer(player);
 * // Salvar síncrono (útil para shutdown)
 * PersistenceSystem.savePlayerSync(player);
 * ```
 */
export class PersistenceSystem {
  // Diretório onde os saves serão armazenados (relativo ao arquivo atual)
  private static readonly SAVE_DIR = path.join(__dirname, "../../../data/players");

  /**
   * Garante que o diretório de saves existe. Se não existir, cria recursivamente.
   * @returns {void}
   */
  private static ensureDir(): void {
    if (!fs.existsSync(this.SAVE_DIR)) {
      fs.mkdirSync(this.SAVE_DIR, { recursive: true });
      Logger.system(`Diretório de saves criado: ${this.SAVE_DIR}`);
    }
  }

  /**
   * Carrega os dados de um jogador a partir do arquivo JSON.
   *
   * @param name - Nome do jogador (corresponde ao nome do arquivo)
   * @returns Dados salvos ou `null` se o arquivo não existir (jogador novo)
   * @throws {Error} Se houver erro de leitura ou parse JSON (o erro é logado e `null` é retornado)
   *
   * @remarks
   * O método é assíncrono e utiliza `fs.promises`.
   * Se o arquivo não existir (código ENOENT), retorna `null` sem lançar erro.
   * Outros erros são registrados no log e também retornam `null`.
   *
   * @example
   * ```typescript
   * const saved = await PersistenceSystem.loadPlayer("Richard");
   * if (saved) {
   *   // Restaurar jogador
   * } else {
   *   // Criar novo jogador
   * }
   * ```
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
   *
   * @param player - Instância do jogador (objeto em memória)
   * @returns {Promise<void>}
   * @throws {Error} Se houver erro de escrita (o erro é logado, mas a exceção é propagada)
   *
   * @remarks
   * Converte o jogador em um objeto `PlayerSaveData`, transformando `Map`s em objetos simples,
   * e escreve o JSON no arquivo correspondente ao nome do jogador.
   *
   * @example
   * ```typescript
   * await PersistenceSystem.savePlayer(player);
   * console.log("Jogador salvo!");
   * ```
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
   *
   * @param player - Instância do jogador
   * @returns {void}
   * @throws {Error} Se houver erro de escrita (o erro é logado, mas a execução continua)
   *
   * @remarks
   * Utiliza `fs.writeFileSync` e não é recomendado para uso frequente (bloqueia o event loop).
   * Deve ser usado apenas durante o desligamento do servidor.
   *
   * @example
   * ```typescript
   * process.on("SIGINT", () => {
   *   PersistenceSystem.savePlayerSync(player);
   *   process.exit(0);
   * });
   * ```
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
