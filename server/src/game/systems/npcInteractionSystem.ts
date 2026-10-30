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
    // Fechar autorização antiga ANTES da tentativa: uma abertura inválida
    // não deve deixar a sessão antiga utilizável em segundo plano.
    this.close(player);
    if (!this.canInteract(player, world, npc, service)) return false;
    sessions.set(player, { world, npc, service });
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
    sessions.delete(player);
    return true;
  }

  /** Despedida, desconexão ou troca explícita de contexto. Idempotente. */
  static close(player: Player): void {
    sessions.delete(player);
  }
}
