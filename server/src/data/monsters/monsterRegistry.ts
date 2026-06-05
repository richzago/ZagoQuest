/**
 * monsterRegistry.ts
 *
 * Registro central de monstros.
 * Carrega recursivamente todos os arquivos JSON da pasta `data/monsters`
 * e permite busca por caminho completo ou nome curto (ex: "rat").
 *
 * @module data/monsters/MonsterRegistry
 */

import fs from "fs";
import path from "path";
import { Logger } from "../../game/core/logger/logger";
import { MonsterType } from "../../shared/interfaces/monster.interface";

export class MonsterRegistry {
  /** Cache dos monstros carregados (caminho completo → dados) */
  private static cache = new Map<string, MonsterType>();
  /** Mapeamento de nome curto (ex: "rat") → caminho completo (ex: "animals/lowlevel/rat") */
  private static shortNameToFullId = new Map<string, string>();

  /**
   * Carrega recursivamente todos os arquivos `.json` da pasta `data/monsters`.
   * Deve ser chamado uma vez durante a inicialização do servidor.
   */
  static loadAll(): void {
    const baseDir = path.join(__dirname);
    if (!fs.existsSync(baseDir)) {
      Logger.error(`[MonsterRegistry] Pasta não encontrada: ${baseDir}`);
      return;
    }

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".json")) {
          try {
            const raw = fs.readFileSync(fullPath, "utf-8");
            const data: MonsterType = JSON.parse(raw);
            // Caminho relativo a partir da baseDir (ex: "animals/lowlevel/rat")
            let relativePath = fullPath
              .replace(baseDir, "")
              .replace(/^\//, "")
              .replace(/\\/g, "/")
              .replace(/\.json$/, "");
            // Remove possíveis prefixos "src/data/monsters" se ainda restarem
            relativePath = relativePath.replace(/^src\/data\/monsters\//, "");
            // Armazena no cache pelo caminho completo
            this.cache.set(relativePath, data);
            // Mapeia nome curto (ex: "rat") -> caminho completo
            const shortName = entry.name.replace(/\.json$/, "");
            if (!this.shortNameToFullId.has(shortName)) {
              this.shortNameToFullId.set(shortName, relativePath);
            } else {
              Logger.warn(
                `[MonsterRegistry] Nome curto duplicado: '${shortName}' já mapeado para '${this.shortNameToFullId.get(shortName)}', ignorando '${relativePath}'`,
              );
            }
            // Usa Logger.system (ou Logger.world) para registrar carregamento
            Logger.system(`[MonsterRegistry] Carregado: ${relativePath} (short: ${shortName})`);
          } catch (err) {
            Logger.error(`[MonsterRegistry] Erro ao carregar ${fullPath}: ${err}`);
          }
        }
      }
    };

    walk(baseDir);
    Logger.system(`[MonsterRegistry] Carregados ${this.cache.size} monstros.`);
  }

  /**
   * Obtém os dados de um monstro a partir do caminho relativo ou nome curto.
   *
   * @param idOrShortName - Caminho completo (ex: "animals/lowlevel/rat") ou nome curto (ex: "rat")
   * @returns Objeto com os dados do monstro (MonsterType) ou `undefined` se não encontrado.
   */
  static get(idOrShortName: string): MonsterType | undefined {
    // Tenta diretamente como caminho completo
    if (this.cache.has(idOrShortName)) {
      return this.cache.get(idOrShortName);
    }
    // Tenta resolver nome curto
    const fullId = this.shortNameToFullId.get(idOrShortName);
    if (fullId && this.cache.has(fullId)) {
      return this.cache.get(fullId);
    }
    return undefined;
  }

  /**
   * Verifica se um monstro existe (por caminho completo ou nome curto).
   */
  static exists(idOrShortName: string): boolean {
    return this.cache.has(idOrShortName) || this.shortNameToFullId.has(idOrShortName);
  }

  /**
   * Retorna todos os monstros carregados (útil para debug).
   */
  static getAll(): Map<string, MonsterType> {
    return this.cache;
  }
}
