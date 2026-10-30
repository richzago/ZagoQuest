import { readdirSync, readFileSync } from "fs";
import { join, basename } from "path";
import { Logger } from "../../game/core/logger/logger";
import { ItemType } from "../../shared/interfaces/item.interface";

export class ItemRegistry {
  private static items = new Map<string, ItemType>();

  /**
   * Carrega recursivamente todos os arquivos .json da pasta base.
   * Cada item é registrado sob duas chaves:
   * - O `id` definido dentro do JSON (caminho completo, se existir).
   * - O nome base do arquivo (ex: `bone_sword`).
   * Ambos apontam para o mesmo objeto.
   *
   * @param basePath - Caminho absoluto para a pasta raiz dos itens
   */
  static loadAll(basePath: string): void {
    Logger.system(`Carregando itens a partir de: ${basePath}`);
    // Reload must not retain definitions removed from disk.
    this.items.clear();
    this.loadDirectory(basePath);
    Logger.system(`ItemRegistry: ${this.items.size} itens carregados.`);
    const sample = Array.from(this.items.keys()).slice(0, 5);
    if (sample.length) {
      Logger.system(`Exemplos de IDs carregados: ${sample.join(", ")}`);
    } else {
      Logger.error(`Nenhum item foi carregado! Verifique o caminho: ${basePath}`);
    }
  }

  private static loadDirectory(dir: string): void {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        // This directory contains ConditionDefinition, not ItemType.
        // ConditionRegistry owns it; it must not pollute item lookups.
        if (entry.name === "conditions") continue;
        this.loadDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        try {
          const raw = readFileSync(fullPath, "utf-8");
          if (!raw.trim()) {
            Logger.warn(`[ItemRegistry] Arquivo JSON vazio (definição pendente): ${fullPath}`);
            continue;
          }
          const data = JSON.parse(raw);
          // Suporta tanto um único item quanto um array
          const itemsArray = Array.isArray(data) ? data : [data];
          for (const item of itemsArray) {
            if (!item || typeof item.id !== "string" || !item.id.trim() ||
                !["currency", "consumable", "equipment", "quest", "loot"].includes(item.type)) {
              Logger.error(`Definição inválida de item (id/type) em ${fullPath}`);
              continue;
            }
            // Canonical ID always takes precedence over any short alias.
            if (this.items.has(item.id)) {
              Logger.error(`ID duplicado de item "${item.id}" no arquivo ${fullPath}; ignorado.`);
              continue;
            }
            this.items.set(item.id, item);

            // Array JSONs may contain many different items; using the file name
            // as their shared alias ("fish", "baits") selects the wrong item.
            const shortId = Array.isArray(data)
              ? item.id.split("/").pop()!
              : basename(entry.name, ".json");
            if (shortId !== item.id) {
              if (this.items.has(shortId)) {
                Logger.warn(
                  `Conflito de shortId: "${shortId}" já usado por ${this.items.get(shortId)?.id}. Ignorando para ${item.id}.`,
                );
              } else {
                this.items.set(shortId, item);
              }
            }
          }
        } catch (err) {
          Logger.error(`Erro ao carregar ${fullPath}: ${err}`);
        }
      }
    }
  }

  /**
   * Obtém um item pelo ID (pode ser o nome completo ou o nome base do arquivo).
   * @throws Se o item não existir.
   */
  static get(id: string): ItemType {
    // 1. Tenta encontrar pelo ID completo
    let item = this.items.get(id);
    if (item) return item;

    // 2. Tenta extrair o shortId (última parte após a última barra)
    const shortId = id.includes("/") ? id.substring(id.lastIndexOf("/") + 1) : id;
    item = this.items.get(shortId);
    if (item) return item;

    // 3. Normalização robusta: remove tudo que não é letra/número, converte para minúsculo
    const normalize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const normalizedInput = normalize(id);

    // Percorre todos os itens registrados e compara com o normalizedInput
    for (const [key, value] of this.items.entries()) {
      const normalizedKey = normalize(key);
      if (normalizedKey === normalizedInput) {
        return value;
      }
    }

    // 4. Fallback final: tenta extrair o nome do arquivo (último segmento sem extensão)
    // Isso é útil se o ID for algo como "equipment/weapon/swords/boneSword" e o item estiver
    // registrado como "bone_sword" (o normalize já deve pegar, mas deixamos como segurança)
    const fileName =
      id
        .split("/")
        .pop()
        ?.replace(/\.[^/.]+$/, "") || "";
    if (fileName) {
      const normalizedFileName = normalize(fileName);
      for (const [key, value] of this.items.entries()) {
        if (normalize(key) === normalizedFileName) {
          return value;
        }
      }
    }

    throw new Error(`Item não encontrado: ${id}`);
  }
}
