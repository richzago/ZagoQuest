/**
 * Autorização temporária para interações econômicas com NPCs.
 *
 * Uma mensagem bem tipada NÃO significa que o jogador tenha permissão para
 * depositar, sacar ou comprar. O servidor abre uma interação somente quando
 * o jogador está próximo de um NPC válido, e revalida em toda operação.
 *
 * O protocolo legado de banco usa { type: "deposit", amount } sem npcId.
 * Guardamos no servidor qual banqueiro autorizou essa sessão. O cliente
 * nunca informa (nem escolhe) a sessão econômica.
 */
import type { Player } from "../entities/player";
import type { Npc } from "../entities/npc";
import type { World } from "../world/World";

export type EconomyService = "banker" | "merchant";
export const NPC_INTERACTION_RANGE = 2; // Distância Manhattan, igual ao /hi.

interface ActiveInteraction {
  readonly world: World;
  readonly npc: Npc;
  readonly service: EconomyService;
}

/**
 * WeakMap: uma sessão por objeto Player; dados não são serializados ao banco.
 * Um jogador desconectado não fica retido na memória por este sistema.
 */
const sessions = new WeakMap<Player, ActiveInteraction>();

export class NpcInteractionSystem {
  /** Verifica a distância e se o NPC ainda pertence a este mundo. */
  static canInteract(
    player: Player,
    world: World,
    npc: Npc,
    service: EconomyService,
  ): boolean {
    if (player.hp <= 0 || npc.hp <= 0 ||
        npc.npcType !== service || !world.npcs.includes(npc)) return false;

    const px = player.position.x;
    const py = player.position.y;
    const nx = npc.position.x;
    const ny = npc.position.y;
    if (![px, py, nx, ny].every(Number.isSafeInteger)) return false;

    const distance = Math.abs(px - nx) + Math.abs(py - ny);
    return distance <= NPC_INTERACTION_RANGE;
  }

  /**
   * Abrir a janela é a autorização inicial: não exige /hi prévio,
   * preservando os senders atuais do Unity.
   * Uma nova janela substitui a interação anterior do mesmo jogador.
   */
  static open(player: Player, world: World, npc: Npc, service: EconomyService): boolean {
    // A sessão anterior perde autorização e o NPC anterior volta à rotina.
    // Mesmo uma abertura inválida não preserva a sessão econômica antiga.
    this.close(player);
    this.releaseConversation(player, world);

    // Respeita NPC ocupado por OUTRO jogador; a confirmação é no servidor.
    if (!this.canInteract(player, world, npc, service) ||
        (npc.isTalking && npc.talkingToPlayerId !== player.id)) return false;

    sessions.set(player, { world, npc, service });
    npc.isTalking = true;
    npc.talkingToPlayerId = player.id;
    return true;
  }

  /**
   * Obtém a interação autorizada, revalidando TODAS as condições.
   * Se a janela estiver obsoleta, revoga a autorização imediatamente.
   */
  static getActive(
    player: Player,
    world: World,
    service: EconomyService,
    npcId?: string,
  ): Npc | undefined {
    const active = sessions.get(player);
    if (!active) return undefined;
    if (active.world !== world ||
        active.service !== service ||
        (npcId !== undefined && active.npc.id !== npcId) ||
        !this.canInteract(player, world, active.npc, service)) {
      this.close(player);
      return undefined;
    }
    return active.npc;
  }

  /** Chamado após movimentos aceitos: revoga imediatamente se se afastou. */
  static invalidateIfOutOfRange(player: Player, world: World): void {
    const active = sessions.get(player);
    if (!active) return;
    if (active.world !== world ||
        !this.canInteract(player, world, active.npc, active.service)) {
      this.close(player);
    }
  }

  /**
   * Fecha a janela declarada pelo cliente, sem afetar outro serviço aberto
   * depois dela. Nunca confia no npcId para abrir ou autorizar operações.
   */
  static closeIfActive(player: Player, service: EconomyService, npcId: string): boolean {
    const active = sessions.get(player);
    if (!active || active.service !== service || active.npc.id !== npcId) {
      return false;
    }
    this.close(player);
    return true;
  }

  /**
   * Remove o diálogo (inclusive "/hi" sem janela econômica). Útil para
   * troca de NPC e despedida; o próximo tick da IA pode voltar a movê-lo.
   */
  static releaseConversation(player: Player, world: World): void {
    for (const npc of world.npcs) {
      if (npc.talkingToPlayerId !== player.id) continue;
      npc.isTalking = false;
      npc.talkingToPlayerId = undefined;
    }
  }

  /** Despedida, desconexão ou troca de contexto: autorização + pausa da IA. */
  static close(player: Player): void {
    const active = sessions.get(player);
    sessions.delete(player);
    if (active && active.npc.talkingToPlayerId === player.id) {
      active.npc.isTalking = false;
      active.npc.talkingToPlayerId = undefined;
    }
  }
}
