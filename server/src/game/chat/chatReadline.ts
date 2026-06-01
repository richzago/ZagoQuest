import readline from "readline";
import { Player } from "../entities/player";
import { World } from "../world/world";
import { processChatCommand } from "./chatCommands";
import { Logger } from "../core/logger/logger";

export function activateChat(player: Player, world: World): void {
  // Desliga o raw mode (se estiver ativo) e restaura o terminal normal
  process.stdin.setRawMode(false);
  process.stdin.pause(); // pausa o stream para não interferir

  // Desliga logs no console
  Logger.setConsoleOutput(false);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n[CHAT] Modo chat ativado. Digite /s, /c, /t, /w, /report");
  rl.question("> ", (answer) => {
    if (answer.trim() && answer.startsWith("/")) {
      processChatCommand(answer, player, world);
    } else if (answer.trim()) {
      console.log("[CHAT] Comando inválido.");
    }

    rl.close();

    // Reativa o raw mode e o stream
    process.stdin.resume();
    process.stdin.setRawMode(true);

    // Reativa logs
    Logger.setConsoleOutput(true);

    console.log("[CHAT] Modo chat finalizado. Voltando ao jogo.");
  });
}
