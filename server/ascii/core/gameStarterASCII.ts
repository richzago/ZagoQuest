// /**
//  * gameStarterASCII.ts
//  *
//  * Versão legada do inicializador do jogo, com suporte a renderização ASCII e entrada via teclado.
//  * Utiliza o renderizador ASCII, inputHandler e gameLoop com pausa para chat.
//  *
//  * ⚠️ **ATENÇÃO:** Este arquivo é mantido apenas para compatibilidade com testes antigos.
//  * Não deve ser usado na versão final do servidor (headless + WebSocket).
//  * Ele será movido para a pasta `ascii/core/`.
//  *
//  * @module ascii/core/gameStarterASCII
//  */

// import { AsciiRenderer } from "../rendering/asciiRenderer";
// import { setupInput } from "../core/inputHandler";
// import { setupGracefulShutdown } from "../../core/shutdownHandler"; // graceful shutdown é compartilhado
// import { startGameLoops } from "../core/gameLoopASCII"; // versão ASCII do gameLoop (com render)
// import { startScheduledTasks } from "../../core/scheduledTasks";
// import { Logger } from "../../core/logger/logger";
// import { createWorldAndPlayer } from "../../initialization/worldFactory";
// import { World } from "../../world/World";

// /**
//  * Inicia o jogo na versão ASCII (terminal).
//  *
//  * @param characterName - Nome do personagem a ser carregado/criado
//  * @returns {Promise<void>}
//  *
//  * @remarks
//  * **Fluxo de execução (legado):**
//  * 1. Cria o mundo e o jogador via `createWorldAndPlayer()`.
//  * 2. Instancia o renderizador ASCII.
//  * 3. Configura o input do teclado (modo raw) para comandos e chat.
//  * 4. Configura o graceful shutdown (salva ao sair).
//  * 5. Inicia os loops do jogo (IA + renderização) – loop de render pode ser pausado pelo chat.
//  * 6. Inicia tarefas agendadas (autosave, guildas).
//  *
//  * @example
//  * ```typescript
//  * // Para testes locais (não usar em produção)
//  * startGameASCII("Richard");
//  * ```
//  */
// export async function startGameASCII(characterName: string): Promise<void> {
//   const { world, player } = await createWorldAndPlayer(characterName);

//   // Renderizador ASCII (terminal)
//   const renderer = new AsciiRenderer();

//   // Configura entrada de teclado (modo raw)
//   setupInput(player, world);

//   // Graceful shutdown (salva ao encerrar)
//   setupGracefulShutdown(player);

//   // Inicia loops: IA (monstros) + renderização ASCII (com pausa para chat)
//   startGameLoops(world, renderer);

//   // Tarefas periódicas (autosave, etc.)
//   startScheduledTasks(player);

//   Logger.system(`Jogo ASCII iniciado com o personagem: ${characterName}`);
// }

// /**
//  * Inicia APENAS o loop de IA (sem renderização) – útil para testes headless.
//  * Esta versão não é usada no ASCII, mas mantida por consistência.
//  *
//  * @param world - Mundo do jogo
//  */
// export function startAiOnlyLoop(world: World): void {
//   setInterval(() => {
//     world.monsters.forEach((monster) => {
//       monster.ai.update(monster, world);
//       monster.conditionManager.update();
//     });
//     world.npcs.forEach((npc) => npc.ai?.update(npc, world));
//     world.players.forEach((player) => player.conditionManager.update());
//     world.cleanupDeadMonsters();
//   }, 1500);
// }
