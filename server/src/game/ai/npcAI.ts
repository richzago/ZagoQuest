/**
 * npcAi.ts
 *
 * Inteligência artificial para NPCs (não combatentes).
 * - Move-se lentamente dentro de uma área limitada (radius).
 * - Para de andar se o NPC estiver em conversa (isTalking = true).
 * - Volta a andar quando isTalking = false (conversa encerrada).
 * - Se o jogador se afastar (distância > 3), a conversa é automaticamente encerrada.
 *
 * @module game/ai/NpcAI
 */

import { Npc } from "../entities/npc";
import { World } from "../world/World";
import { WebSocketServer } from "../../network/websocket/wsServer"; // para enviar mensagem de desengajamento

/**
 * NPC:
 * - nunca ataca
 * - anda lentamente dentro de um raio (originX, originY)
 * - respeita um cooldown entre movimentos
 * - a interrupção do movimento é controlada pela flag `isTalking` no NPC.
 *
 * @class NpcAI
 * @param originX - Posição X central da área de movimento (ponto de spawn)
 * @param originY - Posição Y central da área de movimento
 * @param radius - Raio (distância Manhattan) máximo de deslocamento (padrão 2)
 * @param moveCooldownMs - Intervalo mínimo entre movimentos (padrão 3000 ms)
 */
export class NpcAI {
  private lastMoveTime: number = 0;
  private moveCooldownMs: number;

  constructor(
    private originX: number,
    private originY: number,
    private radius: number = 2,
    moveCooldownMs: number = 3000,
    private readonly interactionRadius: number = 3,
  ) {
    this.moveCooldownMs = moveCooldownMs;
  }

  /**
   * Atualiza o movimento do NPC a cada tick (chamado a cada 1.5s pelo game loop).
   *
   * @param npc - O NPC a ser controlado
   * @param world - Mundo (para verificar colisões e jogadores)
   *
   * @remarks
   * O movimento só ocorre se:
   * - O NPC não estiver conversando (npc.isTalking === false)
   * - O cooldown desde o último movimento já tiver passado
   * - O destino for caminhável (colisão + ocupação)
   * - Estiver dentro do raio (caso contrário, retorna ao centro)
   *
   * Além disso, se o NPC estiver conversando, verifica se o jogador se afastou.
   * Se a distância for maior que 3 tiles, a conversa é encerrada automaticamente.
   */
  update(npc: Npc, world: World): void {
    // =========================
    // 1. Verifica se o NPC está conversando e se deve desengajar automaticamente
    // =========================
    if (npc.isTalking && npc.talkingToPlayerId !== undefined) {
      const player = world.players.find((p) => p.id === npc.talkingToPlayerId);
      if (!player) {
        // Jogador desconectou ou não existe mais
        npc.isTalking = false;
        npc.talkingToPlayerId = undefined;
      } else {
        const dx = Math.abs(player.position.x - npc.position.x);
        const dy = Math.abs(player.position.y - npc.position.y);
        const distance = dx + dy; // distância Manhattan
        if (distance > this.interactionRadius) {
          // Jogador se afastou → encerra conversa
          npc.isTalking = false;
          npc.talkingToPlayerId = undefined;

          // Opcional: envia uma mensagem para o jogador informando o desengajamento
          const wsServer = WebSocketServer.getInstance();
          if (wsServer) {
            wsServer.sendChatToPlayer(player.id, `[NPC] ${npc.name} se afastou e voltou a andar.`);
          }
          // Não retorna ainda – permite que o NPC se mova neste mesmo ciclo
        }
      }
    }

    // =========================
    // 2. Se ainda está conversando, não se move
    // =========================
    if (npc.isTalking) return;

    // =========================
    // 3. Movimento padrão (cooldown, wander, retorno ao centro)
    // =========================
    const now = Date.now();
    if (now - this.lastMoveTime < this.moveCooldownMs) return;

    const dx = npc.position.x - this.originX;
    const dy = npc.position.y - this.originY;
    const currentDist = Math.abs(dx) + Math.abs(dy);

    let moveX = 0,
      moveY = 0;

    if (currentDist >= this.radius) {
      // Força retorno ao centro (direção que reduz a distância)
      moveX = Math.sign(this.originX - npc.position.x);
      moveY = Math.sign(this.originY - npc.position.y);
      // Raio 0 mantém o NPC parado na origem, sem gastar cooldown.
      if (moveX === 0 && moveY === 0) return;
    } else {
      // Movimento aleatório dentro do raio – só permite se o destino ficar dentro do raio
      const moves = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ];
      const validMoves = moves.filter((m) => {
        const newX = npc.position.x + m.x;
        const newY = npc.position.y + m.y;
        const newDist = Math.abs(newX - this.originX) + Math.abs(newY - this.originY);
        return newDist <= this.radius;
      });
      if (validMoves.length === 0) return; // nenhuma direção segura (não deve acontecer)
      const move = validMoves[Math.floor(Math.random() * validMoves.length)];
      moveX = move.x;
      moveY = move.y;
    }

    const newX = npc.position.x + moveX;
    const newY = npc.position.y + moveY;
    if (world.isPositionWalkable(newX, newY, npc.id)) {
      npc.move(moveX, moveY, world);
      this.lastMoveTime = now;
    }
  }
}
