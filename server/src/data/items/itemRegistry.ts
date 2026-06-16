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
        this.loadDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        try {
          const raw = readFileSync(fullPath, "utf-8");
          const data = JSON.parse(raw);
          // Suporta tanto um único item quanto um array
          const itemsArray = Array.isArray(data) ? data : [data];
          for (const item of itemsArray) {
            if (!item.id) {
              Logger.error(`Item sem ID no arquivo ${fullPath}`);
              continue;
            }
            // Registra pelo ID completo
            this.items.set(item.id, item);

            // Registra também pelo nome base do arquivo (sem extensão)
            const shortId = basename(entry.name, ".json");
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
    const item = this.items.get(id);
    if (!item) throw new Error(`Item não encontrado: ${id}`);
    return item;
  }
}
