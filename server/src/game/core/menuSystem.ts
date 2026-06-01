/**
 * menuSystem.ts
 * Gerencia menus interativos (comerciante, banqueiro, etc.).
 * Mantém estado global de menu ativo e processa a entrada do usuário.
 */

import { Player } from "../entities/player";
import { Npc } from "../entities/npc";
import { Logger } from "./logger/logger";
import { MenuOption } from "../../shared/types/menu.type";
/**
 * Definição de uma opção de menu.
 */


// Estado global do menu (simples, pois o Node é single-thread)
let activeMenu: {
  player: Player;
  npc: Npc;
  options: MenuOption[];
  onCancel?: () => void;
} | null = null;

/**
 * Verifica se há um menu ativo no momento.
 */
export function isMenuActive(): boolean {
  return activeMenu !== null;
}

/**
 * Exibe um menu para o jogador.
 * @param player Jogador alvo
 * @param npc NPC com o qual está interagindo
 * @param options Lista de opções do menu
 * @param onCancel Função opcional chamada ao cancelar (tecla 'q')
 */
export function showMenu(
  player: Player,
  npc: Npc,
  options: MenuOption[],
  onCancel?: () => void,
): void {
  activeMenu = { player, npc, options, onCancel };
  Logger.economy(`--- ${npc.name} ---`);
  options.forEach((opt, idx) => {
    Logger.economy(`${idx + 1} - ${opt.label}`);
  });
  Logger.economy("q - Cancelar");
}

/**
 * Processa a entrada do teclado quando um menu está ativo.
 * Deve ser chamada no handler de teclas do main.ts.
 * @param keyStr Tecla pressionada (string de um único caractere)
 */
export function handleMenuInput(keyStr: string): void {
  if (!activeMenu) return;
  const { player, npc, options, onCancel } = activeMenu;

  if (keyStr === "q") {
    Logger.economy("Cancelado.");
    if (onCancel) onCancel();
    activeMenu = null;
    return;
  }

  const idx = parseInt(keyStr, 10) - 1;
  if (idx >= 0 && idx < options.length) {
    options[idx].action(player, npc);
    activeMenu = null;
  } else {
    Logger.economy(`Opção inválida. Use 1..${options.length} ou q.`);
  }
}
