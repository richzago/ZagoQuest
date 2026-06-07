// /**
//  * chatReadline.ts
//  *
//  * Gerencia o modo de chat usando readline, desativando temporariamente o raw mode
//  * para permitir digitação de comandos sem interferência do renderizador ou logs.
//  *
//  * @module game/chat/chatReadline
//  */
//  * ⚠️ **ATENÇÃO:** Este arquivo é mantido apenas para compatibilidade com testes antigos.
//  * Não deve ser usado na versão final do servidor (headless + WebSocket).
//  * Ele será movido para a pasta `ascii/core/`.
// import readline from "readline";
// import { Player } from "../entities/player";
// import { World } from "../world/World";
// import { processChatCommand } from "./chatCommands";
// import { Logger } from "../core/logger/logger";

// /**
//  * Ativa o modo chat usando readline.
//  * Desativa o raw mode, pausa logs no console, abre um prompt e aguarda o comando.
//  * Após o envio, reativa o raw mode e os logs.
//  *
//  * @param player - Jogador atual
//  * @param world - Mundo (necessário para alguns comandos)
//  * @returns {void}
//  *
//  * @example
//  * // Chamado pela tecla '/' no inputHandler
//  * activateChat(player, world);
//  */
// export function activateChat(player: Player, world: World): void {
//   // Desliga o raw mode (se estiver ativo) e restaura o terminal normal
//   process.stdin.setRawMode(false);
//   process.stdin.pause(); // pausa o stream para não interferir

//   // Desliga logs no console (evita poluição durante a digitação)
//   Logger.setConsoleOutput(false);

//   const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout,
//   });

//   console.log("\n[CHAT] Modo chat ativado. Digite /s, /c, /t, /w, /report, /guild, /gmsg");
//   rl.question("> ", async (answer) => {
//     if (answer.trim() && answer.startsWith("/")) {
//       await processChatCommand(answer, player, world);
//     } else if (answer.trim()) {
//       console.log("[CHAT] Comando inválido.");
//     }

//     rl.close();

//     // Reativa o raw mode e o stream
//     process.stdin.resume();
//     process.stdin.setRawMode(true);

//     // Reativa logs
//     Logger.setConsoleOutput(true);

//     console.log("[CHAT] Modo chat finalizado. Voltando ao jogo.");
//   });
// }
