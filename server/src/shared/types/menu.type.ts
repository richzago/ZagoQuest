import { Player } from "../../game/entities/player";
import { Npc } from "../../game/entities/npc";

/**
 * Opção de menu interativo (comerciante, banqueiro, etc.).
 */
export type MenuOption = {
  label: string; // texto exibido (ex: "Health Potion (10g)")
  action: (player: Player, npc: Npc) => void; // ação a executar quando selecionada
};
