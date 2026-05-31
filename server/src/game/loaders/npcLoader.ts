import { World } from "../world/world";
import { Npc } from "../entities/npc";
import { NpcAI } from "../ai/npcAI";
import { Logger } from "../core/logger/logger";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

export function loadNpcs(world: World): void {
  console.log("=== loadNpcs iniciada ===");
  const npcDir = join(process.cwd(), "src", "data", "npc");
  console.log("Caminho npcDir:", npcDir);

  if (!existsSync(npcDir)) {
    Logger.error(`[NPC Loader] Pasta não encontrada: ${npcDir}`);
    return;
  }

  const files = readdirSync(npcDir).filter((file) => file.endsWith(".json"));
  console.log("Arquivos encontrados:", files);
  Logger.system(`[NPC Loader] Encontrados ${files.length} arquivos JSON`);

  for (const file of files) {
    const filePath = join(npcDir, file);
    try {
      const raw = readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);
      console.log("Carregando NPC:", data.name, data.x, data.y);

      if (!data.id || !data.name || data.x === undefined || data.y === undefined) {
        Logger.error(`[NPC Loader] ${file}: faltam id, name, x ou y.`);
        continue;
      }

      const npc = new Npc(
        data.id,
        data.name,
        data.x,
        data.y,
        data.message || "",
        data.type || "quest",
      );
      if (data.shopItems) npc.shopItems = data.shopItems;
      if (data.ai) npc.ai = new NpcAI(data.ai.originX, data.ai.originY, data.ai.radius);

      world.addNpc(npc);
      Logger.world(
        `NPC carregado: ${npc.name} (${npc.npcType}) em (${npc.position.x}, ${npc.position.y})`,
      );
    } catch (err) {
      console.error("Erro ao carregar", file, err);
      Logger.error(`[NPC Loader] Erro ao carregar ${file}: ${err}`);
    }
  }
}
