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
    const filePath = join(__dirname, "conditions.json");
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
