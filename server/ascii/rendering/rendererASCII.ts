// /**
//  * AsciiRenderer.ts
//  *
//  * Renderiza o mundo em modo texto (ASCII) no terminal.
//  * Exibe uma viewport (janela) de 9x7 tiles centrada no jogador.
//  *
//  * ⚠️ **ATENÇÃO:** Este arquivo é mantido apenas para compatibilidade com testes antigos.
//  * Não deve ser usado na versão final do servidor (headless + WebSocket).
//  * Ele será movido para a pasta `ascii/core/`.
//  * Prioridade:
//  * 1. Entidades (Player, Monster, NPC) – mostram um caractere especial (P, M, N)
//  * 2. Tiles – chão (.) ou parede (#)
//  *
//  * A cada frame, limpa o console e desenha a nova viewport.
//  *
//  * @module game/rendering/AsciiRenderer
//  */

// import { World } from "../world/World";
// import { Player } from "../entities/player";
// import { Monster } from "../entities/monster";
// import { Npc } from "../entities/npc";

// /**
//  * Renderizador ASCII que produz uma visualização do mundo centrada no jogador.
//  * É usado apenas para depuração e testes; o cliente final usará Unity.
//  *
//  * @class AsciiRenderer
//  *
//  * @example
//  * ```typescript
//  * const renderer = new AsciiRenderer();
//  * setInterval(() => renderer.render(world), 1000);
//  * ```
//  */
// export class AsciiRenderer {
//   /**
//    * Renderiza uma "janela" do mundo ao redor do jogador.
//    *
//    * @param world - Mundo atual (contém tiles, entidades, jogador)
//    * @returns {void}
//    *
//    * @remarks
//    * O método:
//    * 1. Obtém o primeiro jogador da lista `world.players`.
//    * 2. Calcula a posição da viewport centrada nesse jogador.
//    * 3. Itera sobre cada célula da viewport, desenhando primeiro entidades (P, M, N)
//    *    e depois tiles (. para caminhável, # para obstáculo, espaço para fora do mapa).
//    * 4. Limpa o console e exibe o resultado.
//    *
//    * A viewport tem tamanho fixo de 9x7 tiles.
//    *
//    * @example
//    * ```typescript
//    * // Chamado a cada segundo pelo game loop
//    * renderer.render(world);
//    * ```
//    */
//   render(world: World) {
//     // Dimensões da viewport (largura e altura em tiles)
//     const VIEW_WIDTH = 9;
//     const VIEW_HEIGHT = 7;

//     // Obtém o primeiro jogador (em um MMORPG, deveria ser o jogador local)
//     const player = world.players[0];
//     if (!player) return; // Se não há jogador, não renderiza

//     // Calcula o ponto superior esquerdo da viewport (centrado no jogador)
//     // Ex: se VIEW_WIDTH = 9, Math.floor(VIEW_WIDTH/2) = 4 → startX = player.x - 4
//     const startX = player.position.x - Math.floor(VIEW_WIDTH / 2);
//     const startY = player.position.y - Math.floor(VIEW_HEIGHT / 2);

//     let output = "";

//     // Itera sobre cada linha da viewport
//     for (let y = 0; y < VIEW_HEIGHT; y++) {
//       // Itera sobre cada coluna da viewport
//       for (let x = 0; x < VIEW_WIDTH; x++) {
//         // Coordenada real no mundo
//         const worldX = startX + x;
//         const worldY = startY + y;

//         // ----------------------------------------------------------
//         // 1. Verifica se há uma entidade nesta posição
//         // ----------------------------------------------------------
//         const entity = world.getEntityAt(worldX, worldY);
//         if (entity) {
//           if (entity instanceof Player) {
//             output += "P"; // Jogador
//           } else if (entity instanceof Monster) {
//             output += "M"; // Monstro
//           } else if (entity instanceof Npc) {
//             output += "N"; // NPC
//           } else {
//             output += "?"; // Qualquer outra entidade (fallback)
//           }
//           continue; // Pula a verificação de tile (entidade sobrepõe o chão)
//         }

//         // ----------------------------------------------------------
//         // 2. Sem entidade, renderiza o tile do chão/parede
//         // ----------------------------------------------------------
//         const tile = world.getTile(worldX, worldY);
//         if (!tile) {
//           output += " "; // Fora dos limites do mapa (espaço vazio)
//           continue;
//         }

//         // Tile caminhável (chão, grama, etc.) → ponto "."
//         // Tile não caminhável (parede, árvore) → hash "#"
//         output += tile.walkable ? "." : "#";
//       }
//       output += "\n"; // Quebra de linha após cada linha da viewport
//     }

//     // Limpa todo o terminal (simula uma tela limpa a cada frame)
//     console.clear();
//     // Exibe o mapa renderizado
//     console.log(output);
//   }
// }
