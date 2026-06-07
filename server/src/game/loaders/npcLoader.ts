/**
 * npcLoader.ts
 *
 * Carrega NPCs a partir de uma object layer do Tiled chamada "NPCSpawn".
 * Cada objeto deve ter a propriedade personalizada `npcId` (ex: "banker", "merchant").
 * As definições dos NPCs (mensagem, tipo, loja, etc.) são lidas de arquivos JSON
 * individuais localizados em `src/data/npc/{npcId}.json`.
 *
 * @module game/loaders/npcLoader
 */

import { World } from "../world/World";
import { Npc } from "../entities/npc";
import { NpcAI } from "../ai/npcAI";
import { Logger } from "../core/logger/logger";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { NpcSpawnData } from "../../shared/interfaces/spawn.interface";

/**
 * Loader especializado para NPCs, utilizando dados do Tiled.
 */
export class NpcLoader {
  /**
   * Carrega NPCs a partir de uma lista de spawns (geralmente vinda do MapLoader).
   * Cada spawn deve conter um `npcId` que corresponde a um arquivo JSON em `data/npc/`.
   *
   * @param world - Mundo onde os NPCs serão inseridos.
   * @param spawns - Lista de spawns com coordenadas e npcId.
   *
   * @remarks
   * - O arquivo JSON do NPC deve existir e conter campos como `id`, `name`, `message`, `type`, `shopItems` e `ai` (opcional).
   * - As coordenadas do arquivo JSON **são ignoradas** em favor das coordenadas do spawn do Tiled.
   * - Se o arquivo não existir, um erro é logado e o spawn é ignorado.
   */
  static loadNpcsFromTiled(world: World, spawns: NpcSpawnData[]): void {
    for (const spawn of spawns) {
      // Constrói o caminho para o arquivo JSON do NPC
      const npcFilePath = join(process.cwd(), "src", "data", "npc", `${spawn.npcId}.json`);

      if (!existsSync(npcFilePath)) {
        Logger.error(
          `[NPC Loader] Arquivo não encontrado para NPC ID '${spawn.npcId}' em ${npcFilePath}`,
        );
        continue;
      }

      try {
        const raw = readFileSync(npcFilePath, "utf-8");
        const data = JSON.parse(raw);

        // Cria o NPC com os dados do arquivo, mas sobrescreve a posição com a do spawn
        const npc = new Npc(
          data.id,
          data.name,
          spawn.x,
          spawn.y,
          data.message || "",
          data.type || "quest",
        );

        // Adiciona itens de loja se existirem (para mercadores)
        if (data.shopItems) npc.shopItems = data.shopItems;

        // Adiciona IA se configurada (para NPCs que se movem, como Guide)
        if (data.ai) {
          npc.ai = new NpcAI(data.ai.originX, data.ai.originY, data.ai.radius);
        }

        world.addNpc(npc);
        Logger.world(
          `[NPC Loader] NPC ${npc.name} (${npc.npcType}) carregado do Tiled em (${spawn.x}, ${spawn.y})`,
        );
      } catch (err) {
        Logger.error(`[NPC Loader] Erro ao carregar NPC ${spawn.npcId}: ${err}`);
      }
    }
  }
}
