/**
 * npcLoader.ts
 *
 * Carrega NPCs a partir de uma object layer do Tiled chamada "NPCSpawn".
 * Cada objeto deve ter a propriedade personalizada `npcId` (ex: "banker", "merchant").
 * As definições dos NPCs (mensagem, tipo, loja, etc.) são lidas de arquivos JSON
 * individuais localizados em `src/data/npc/{npcId}.json`.
 *
 * Além disso, suporta configuração de IA (movimento) diretamente no Tiled, através de
 * propriedades opcionais no objeto:
 * - radius         (int) – raio de movimento (Manhattan) a partir da origem.
 * - interactionRadius (int) – distância a partir da qual o NPC para de andar quando um jogador se aproxima.
 * - moveCooldown   (int) – tempo mínimo (ms) entre movimentos.
 *
 * Se essas propriedades não forem fornecidas, são usados valores padrão.
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
import { NpcType } from "../../shared/types/npc.type";

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
   *
   * A IA do NPC pode ser configurada de duas formas (prioridade):
   * 1. Se o spawn tiver as propriedades `radius`, `interactionRadius` e/ou `moveCooldown`, esses valores serão usados.
   * 2. Caso contrário, se o JSON do NPC possuir um objeto `ai`, seus valores serão usados (para compatibilidade).
   * 3. No mais: radius=5, interactionRadius=3, moveCooldown=1500.
   */
  static loadNpcsFromTiled(world: World, spawns: NpcSpawnData[]): void {
    // Valores padrão
    const DEFAULT_RADIUS = 5;
    const DEFAULT_INTERACTION_RADIUS = 3;
    const DEFAULT_MOVE_COOLDOWN = 1500; // 1500 ms

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
          data.id.toString(),
          data.name,
          spawn.x,
          spawn.y,
          data.message || "",
          data.type as NpcType,
        );

        // Adiciona itens de loja se existirem (para mercadores)
        if (data.shopItems) npc.shopItems = data.shopItems;

        // ====================
        // CONFIGURAÇÃO DA IA DO NPC (movimento)
        // ====================
        // A posição de origem do movimento é a própria posição do spawn (onde o NPC nasce)
        const originX = spawn.x;
        const originY = spawn.y;

        // Tiled object overrides JSON defaults. Reject invalid numbers.
        const nonNegative = (value: unknown, fallback: number): number =>
          typeof value === "number" && Number.isSafeInteger(value) && value >= 0
            ? value : fallback;
        const positive = (value: unknown, fallback: number): number =>
          typeof value === "number" && Number.isSafeInteger(value) && value > 0
            ? value : fallback;
        const jsonAI = data.ai ?? {};
        const radius = nonNegative(spawn.radius, nonNegative(jsonAI.radius, DEFAULT_RADIUS));
        const interactionRadius = nonNegative(
          spawn.interactionRadius, nonNegative(jsonAI.interactionRadius, DEFAULT_INTERACTION_RADIUS),
        );
        const moveCooldown = positive(
          spawn.moveCooldown, positive(jsonAI.moveCooldown, DEFAULT_MOVE_COOLDOWN),
        );
        npc.ai = new NpcAI(originX, originY, radius, moveCooldown, interactionRadius);

        world.addNpc(npc);
        Logger.world(
          `[NPC Loader] NPC criado com ID ${npc.id}, nome ${npc.name}, tipo ${npc.npcType}`,
        );
      } catch (err) {
        Logger.error(`[NPC Loader] Erro ao carregar NPC ${spawn.npcId}: ${err}`);
      }
    }
  }
}
