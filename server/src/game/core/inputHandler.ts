/**
 * inputHandler.ts
 * Configura o terminal em modo raw e encaminha as teclas para os sistemas apropriados.
 */

import { Player } from "../entities/player";
import { World } from "../world/world";
import { immediateCommands } from "./commandHandler";
import { isMenuActive, handleMenuInput } from "./menuSystem";

export function setupInput(player: Player, world: World): void {
  process.stdin.setRawMode(true);
  process.stdin.setEncoding("utf8");
  process.stdin.resume();

  process.stdin.on("data", (key) => {
    const keyStr = key.toString();

    if (isMenuActive()) {
      handleMenuInput(keyStr);
      return;
    }

    if (immediateCommands[keyStr]) {
      immediateCommands[keyStr](player, world);
      return;
    }
  });
}
