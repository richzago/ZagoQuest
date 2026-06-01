/**
 * inputHandler.ts
 *
 * Responsável por configurar a captura de teclas no terminal (modo raw) e
 * direcionar cada tecla para o sistema apropriado:
 *
 * 1. Menu interativo (comerciante, banqueiro) – prioridade máxima
 * 2. Modo chat (ativado pela tecla '/')
 * 3. Comandos imediatos (movimento, ataque, loot, etc.)
 *
 * O modo raw permite ler teclas individualmente, sem necessidade de pressionar Enter,
 * essencial para jogos em tempo real.
 */

import { Player } from "../entities/player";
import { World } from "../world/world";
import { immediateCommands } from "./commandHandler";
import { isMenuActive, handleMenuInput } from "./menuSystem";
import { activateChat } from "../chat/chatReadline";

/**
 * Configura o handler de entrada do teclado.
 * Deve ser chamado uma vez durante a inicialização do jogo.
 *
 * @param player - O jogador atual (para executar ações)
 * @param world  - O mundo (necessário para algumas ações, como ataque)
 */
export function setupInput(player: Player, world: World): void {
  // =========================
  // 1. Coloca o terminal em modo raw
  // =========================
  // Modo raw: desativa buffering de linha, eco automático e tratamento especial de teclas (Ctrl+C, etc.)
  // Permite ler tecla por tecla instantaneamente.
  process.stdin.setRawMode(true);
  // Define a codificação para UTF-8 (suporte a caracteres acentuados)
  process.stdin.setEncoding("utf8");
  // Reativa o stream de entrada (pode ter sido pausado anteriormente)
  process.stdin.resume();

  // =========================
  // 2. Escuta eventos de tecla
  // =========================
  process.stdin.on("data", (key) => {
    // Converte o buffer recebido para string (ex: 'w', 's', '/', etc.)
    const keyStr = key.toString();

    // ----------------------------------------------------------
    // 2.1. Prioridade 1: Menu interativo (comerciante, banqueiro)
    // ----------------------------------------------------------
    // Se um menu está ativo (ex: comprando itens), todas as teclas são enviadas para o menu.
    // Isso impede que o jogador se mova ou execute outras ações enquanto está no menu.
    if (isMenuActive()) {
      handleMenuInput(keyStr);
      return;
    }

    // ----------------------------------------------------------
    // 2.2. Prioridade 2: Iniciar modo chat com a tecla '/'
    // ----------------------------------------------------------
    // Ao pressionar '/', ativamos o modo chat (desativa raw mode, ativa readline).
    // O chat tem seu próprio sistema de buffer e envio.
    if (keyStr === "/") {
      activateChat(player, world);
      return;
    }

    // ----------------------------------------------------------
    // 2.3. Prioridade 3: Comandos imediatos (movimento, ataque, loot, etc.)
    // ----------------------------------------------------------
    // Verifica se a tecla está mapeada no objeto `immediateCommands` (definido em commandHandler.ts).
    // Exemplos: 'w' -> mover para cima, 'f' -> atacar, 'g' -> lootear, etc.
    if (immediateCommands[keyStr]) {
      immediateCommands[keyStr](player, world);
      return;
    }
  });
}
