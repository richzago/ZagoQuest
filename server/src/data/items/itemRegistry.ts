/**
 * itemRegistry.ts
 * Registro central de itens.
 * Carrega arquivos JSON individuais ou arrays de itens.
 */


import { readFileSync } from "fs";
import { join } from "path";
import { Logger } from "../../game/core/logger/logger";
import { ItemType } from "../../shared/interfaces/item.interface";

export class ItemRegistry {
  private static items = new Map<string, ItemType>();

  /**
   * Carrega um ou mais itens a partir de um caminho (relativo à pasta items).
   * Se o arquivo contiver um array, registra cada item individualmente.
   * Se contiver um objeto único, registra esse item.
   */
  static load(path: string): void {
    try {
      const fullPath = join(__dirname, `${path}.json`);
      const raw = readFileSync(fullPath, "utf-8");
      const data = JSON.parse(raw);

      let itemsArray: ItemType[];
      if (Array.isArray(data)) {
        itemsArray = data;
      } else {
        itemsArray = [data];
      }

      for (const item of itemsArray) {
        if (!item.id) {
          Logger.error(`Item sem ID no arquivo ${path}`);
          continue;
        }
        this.items.set(item.id, item);
        Logger.system(`Item carregado: ${item.name} (${item.id})`);
      }
    } catch (err) {
      Logger.error(`Falha ao carregar itens de ${path}: ${err}`);
      throw err;
    }
  }

  /**
   * Obtém um item pelo seu ID.
   * Se ainda não foi carregado, tenta carregar o arquivo correspondente.
   */
  static get(id: string): ItemType {
    let cached = this.items.get(id);
    if (cached) return cached;

    // Tenta carregar o arquivo baseado no prefixo do ID (ex: "fishing/rods/basic_rod" -> "fishing/rods")
    const parts = id.split("/");
    if (parts.length >= 2) {
      const categoryPath = parts.slice(0, 2).join("/"); // "fishing/rods"
      this.load(categoryPath);
      cached = this.items.get(id);
      if (cached) return cached;
    }

    throw new Error(`Item não encontrado: ${id}`);
  }
}
