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


/** A TypeScript interface does not validate external JSON at runtime. */
function invalidMonsterField(value: unknown): string | undefined {
  const isRecord = (entry: unknown): entry is Record<string, unknown> =>
    entry !== null && typeof entry === "object" && !Array.isArray(entry);
  const nonEmpty = (entry: unknown): entry is string =>
    typeof entry === "string" && entry.trim().length > 0;
  const nonNegative = (entry: unknown): entry is number =>
    typeof entry === "number" && Number.isFinite(entry) && entry >= 0;

  if (!isRecord(value)) return "root";
  if (!nonEmpty(value.id)) return "id";
  if (!nonEmpty(value.name)) return "name";
  if (value.level !== undefined &&
      (typeof value.level !== "number" || !Number.isSafeInteger(value.level) || value.level < 1)) return "level";
  if (!isRecord(value.stats)) return "stats";
  if (typeof value.stats.hp !== "number" || !Number.isFinite(value.stats.hp) || value.stats.hp <= 0) return "stats.hp";
  if (value.stats.speed !== undefined && !nonNegative(value.stats.speed)) return "stats.speed";
  if (value.stats.mana !== undefined && !nonNegative(value.stats.mana)) return "stats.mana";
  if (!isRecord(value.combat)) return "combat";
  if (!nonNegative(value.combat.xp)) return "combat.xp";
  if (!nonNegative(value.combat.damageMin)) return "combat.damageMin";
  if (!nonNegative(value.combat.damageMax) || value.combat.damageMax < value.combat.damageMin) return "combat.damageMax";
  if (!isRecord(value.ai)) return "ai";
  if (value.ai.type !== "aggressive" && value.ai.type !== "passive" && value.ai.type !== "flee") return "ai.type";
  if (value.ai.fleeHp !== undefined && !nonNegative(value.ai.fleeHp)) return "ai.fleeHp";
  if (value.ai.attackCooldown !== undefined &&
      (typeof value.ai.attackCooldown !== "number" ||
       !Number.isFinite(value.ai.attackCooldown) || value.ai.attackCooldown <= 0)) return "ai.attackCooldown";
  if (!isRecord(value.visual)) return "visual";
  if (!nonEmpty(value.visual.symbol)) return "visual.symbol";
  if (value.loot !== undefined) {
    if (!Array.isArray(value.loot)) return "loot";
    for (let i = 0; i < value.loot.length; i++) {
      const entry: unknown = value.loot[i];
      if (!isRecord(entry)) return "loot[" + i + "]";
      if (!nonEmpty(entry.itemId)) return "loot[" + i + "].itemId";
      // Loot chance uses a 0..100000 scale in existing game data, not 0..1.
      if (!nonNegative(entry.chance)) return "loot[" + i + "].chance";
      if (entry.min !== undefined &&
          (typeof entry.min !== "number" || !Number.isSafeInteger(entry.min) || entry.min < 0)) return "loot[" + i + "].min";
      if (entry.max !== undefined &&
          (typeof entry.max !== "number" || !Number.isSafeInteger(entry.max) || entry.max < 0 ||
           (typeof entry.min === "number" && entry.max < entry.min))) return "loot[" + i + "].max";
    }
  }
  return undefined;
}

export class MonsterRegistry {
  /** Cache dos monstros carregados (caminho completo → dados) */
  private static cache = new Map<string, MonsterType>();
  /** Mapeamento de nome curto (ex: "rat") → caminho completo (ex: "animals/lowlevel/rat") */
  private static shortNameToFullId = new Map<string, string>();

  /**
   * Carrega recursivamente todos os arquivos `.json` da pasta `data/monsters`.
   * Deve ser chamado uma vez durante a inicialização do servidor.
   */
  static loadAll(baseDir = path.join(process.cwd(), "src", "data", "monsters")): void {
    // JSONs permanecem em src/data mesmo quando executamos dist/main.js.
    // O argumento opcional permite testar o catálogo numa pasta temporária.
    if (!fs.existsSync(baseDir)) {
      throw new Error(`[MonsterRegistry] Pasta de dados não encontrada: ${baseDir}`);
    }

    // Recarregamento não deve acumular entradas desatualizadas.
    this.cache.clear();
    this.shortNameToFullId.clear();

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".json")) {
          try {
            const raw = fs.readFileSync(fullPath, "utf-8");
            if (!raw.trim()) {
              Logger.warn("[MonsterRegistry] JSON vazio (definição pendente): " + fullPath);
              continue;
            }
            const parsed: unknown = JSON.parse(raw);
            const invalidField = invalidMonsterField(parsed);
            if (invalidField) {
              Logger.error("[MonsterRegistry] Definição inválida em " + fullPath + ": campo " + invalidField);
              continue;
            }
            const data = parsed as MonsterType;
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
