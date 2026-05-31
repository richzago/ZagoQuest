import fs from "fs";
import path from "path";

export class MonsterRegistry {
  /**
   * Cache dos monstros já carregados.
   */
  private static cache = new Map<string, any>();

  /**
   * Carrega um monstro a partir do caminho relativo
   * dentro da pasta monsters.
   *
   * Ex:
   * MonsterRegistry.get(
   *   "animals/lowlevel/rat"
   * )
   */
  static get(monsterPath: string) {
    // =========================
    // CACHE
    // =========================

    if (this.cache.has(monsterPath)) {
      return this.cache.get(monsterPath);
    }

    // =========================
    // FILE PATH
    // =========================

    const filePath = path.join(__dirname, `${monsterPath}.json`);

    // =========================
    // LOAD FILE
    // =========================

    const raw = fs.readFileSync(filePath, "utf8");

    const data = JSON.parse(raw);

    // =========================
    // SAVE CACHE
    // =========================

    this.cache.set(monsterPath, data);

    return data;
  }
}
