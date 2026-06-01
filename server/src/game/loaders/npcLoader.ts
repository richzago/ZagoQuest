/**
 * npcLoader.ts
 *
 * Responsável por carregar todos os NPCs a partir de arquivos JSON individuais
 * localizados na pasta `src/data/npc/`.
 *
 * Cada arquivo JSON deve conter:
 * - id (número único)
 * - name (string)
 * - x (número, posição no mapa)
 * - y (número, posição no mapa)
 * - message (string, opcional, mensagem exibida ao interagir)
 * - type (string, opcional: "merchant", "banker", "quest", "trainer" – padrão "quest")
 * - shopItems (array, apenas para type "merchant")
 * - ai (objeto com originX, originY, radius, apenas para NPCs que se movem)
 *
 * O loader lê todos os arquivos .json da pasta, cria instâncias de Npc
 * e as adiciona ao mundo.
 */

import { World } from "../world/world";
import { Npc } from "../entities/npc";
import { NpcAI } from "../ai/npcAI";
import { Logger } from "../core/logger/logger";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Carrega todos os NPCs da pasta `src/data/npc/` e os insere no mundo.
 * @param world Instância do mundo onde os NPCs serão adicionados.
 */
export function loadNpcs(world: World): void {
  // Log de início (útil para depuração)
  console.log("=== loadNpcs iniciada ===");

  // Constrói o caminho absoluto para a pasta de NPCs
  const npcDir = join(process.cwd(), "src", "data", "npc");
  console.log("Caminho npcDir:", npcDir);

  // Verifica se a pasta existe
  if (!existsSync(npcDir)) {
    Logger.error(`[NPC Loader] Pasta não encontrada: ${npcDir}`);
    return;
  }

  // Lista todos os arquivos com extensão .json na pasta
  const files = readdirSync(npcDir).filter((file) => file.endsWith(".json"));
  console.log("Arquivos encontrados:", files);
  Logger.system(`[NPC Loader] Encontrados ${files.length} arquivos JSON`);

  // Itera sobre cada arquivo
  for (const file of files) {
    const filePath = join(npcDir, file);
    try {
      // Lê e faz o parse do JSON
      const raw = readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      console.log("Carregando NPC:", data.name, data.x, data.y);

      // Validação dos campos obrigatórios
      if (!data.id || !data.name || data.x === undefined || data.y === undefined) {
        Logger.error(`[NPC Loader] ${file}: faltam id, name, x ou y.`);
        continue; // Pula este arquivo e continua com o próximo
      }

      // Cria a instância do Npc
      const npc = new Npc(
        data.id,
        data.name,
        data.x,
        data.y,
        data.message || "",
        data.type || "quest",
      );

      // Se o NPC for comerciante, atribui a lista de itens
      if (data.shopItems) npc.shopItems = data.shopItems;

      // Se o NPC tiver configuração de IA (ex: Guide), cria e atribui a IA
      if (data.ai) npc.ai = new NpcAI(data.ai.originX, data.ai.originY, data.ai.radius);

      // Adiciona o NPC ao mundo
      world.addNpc(npc);
      Logger.world(
        `NPC carregado: ${npc.name} (${npc.npcType}) em (${npc.position.x}, ${npc.position.y})`,
      );
    } catch (err) {
      // Em caso de erro (JSON inválido, etc.), loga o erro e continua
      console.error("Erro ao carregar", file, err);
      Logger.error(`[NPC Loader] Erro ao carregar ${file}: ${err}`);
    }
  }
}

//mexer nos logs, console.log, npc 
