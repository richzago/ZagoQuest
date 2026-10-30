/**
 * conditionRegistry.ts
 *
 * Registro central de definições de condições (carregadas de JSON).
 *
 * @module data/conditions/ConditionRegistry
 */

import { readFileSync } from "fs";
import { join } from "path";
import { ConditionDefinition } from "../../../shared/interfaces/condition.interface";
import { Logger } from "../../../game/core/logger/logger";

export class ConditionRegistry {
  private static conditions = new Map<string, ConditionDefinition>();

  static load(): void {
    // JSON está em src/; tsc emite somente arquivos TypeScript em dist/.
    // O servidor já usa process.cwd() para carregar outros dados do jogo.
    const filePath = join(process.cwd(), "src", "data", "items", "conditions", "conditions.json");
    const raw = readFileSync(filePath, "utf-8");
    const data: ConditionDefinition[] = JSON.parse(raw);
    for (const def of data) {
      this.conditions.set(def.id, def);
      Logger.system(`Condição carregada: ${def.name} (${def.id})`);
    }
  }

  static get(id: string): ConditionDefinition {
    const def = this.conditions.get(id);
    if (!def) throw new Error(`Condição não encontrada: ${id}`);
    return def;
  }
}
