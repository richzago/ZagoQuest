/**
 * monsterRegistry.ts
 *
 * Registro central de monstros.
 * Carrega arquivos JSON sob demanda (lazy loading) a partir da pasta `monsters`.
 *
 * @module data/monsters/MonsterRegistry
 */

import fs from "fs";
import path from "path";

export class MonsterRegistry {
  /** Cache dos monstros já carregados (monsterPath → dados brutos do JSON) */
  private static cache = new Map<string, any>();

  /**
   * Obtém os dados de um monstro a partir do caminho relativo dentro da pasta `monsters`.
   *
   * @param monsterPath - Caminho relativo à pasta `src/data/monsters/`, sem extensão `.json`.
   *                      Ex: "animals/lowlevel/rat"
   * @returns Objeto com os dados do monstro (conforme interface MonsterType)
   * @throws Se o arquivo não existir ou o JSON for inválido.
   *
   * @example
   * ```typescript
   * const ratData = MonsterRegistry.get("animals/lowlevel/rat");
   * console.log(ratData.name); // "Rat"
   * ```
   */
  static get(monsterPath: string) {
    // Verifica cache
    if (this.cache.has(monsterPath)) {
      return this.cache.get(monsterPath);
    }

    // Constrói caminho absoluto do arquivo
    const filePath = path.join(__dirname, `${monsterPath}.json`);

    // Lê e faz o parse do JSON
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);

    // Armazena em cache
    this.cache.set(monsterPath, data);

    return data;
  }
}
