/**
 * Ponte entre eventos do domínio (dano / morte) e o protocolo WebSocket.
 *
 * CombatSystem/DeathSystem emitem eventos UMA vez; nenhum handler nem loop
 * de ataque envia dano ou confirmação de morte manualmente.
 *
 * A instância é associada a um World, para não vazar eventos entre servidores
 * de teste ou mundos distintos no mesmo processo.
 */
import { EventSystem } from "../../game/core/events/eventSystem";
import { GameEvent } from "../../shared/enums/gameEvent.enum";
import type {
  CombatDamageEventData,
  MonsterDeathEventData,
} from "../../shared/interfaces/eventData.interface";
import type { World } from "../../game/world/World";

export interface CombatEventTransport {
  broadcastDamage(targetId: string, hp: number, maxHp: number, damage: number): void;
  sendToPlayer(playerId: string, message: string): void;
}

export class CombatEventBridge {
  private readonly events = EventSystem.getInstance();
  private readonly onDamage = (event: CombatDamageEventData): void => {
    if (event.world !== this.world) return;
    this.transport.broadcastDamage(
      event.targetId,
      event.targetHpAfter,
      event.targetMaxHp,
      event.damage,
    );
  };

  private readonly onMonsterDeath = (event: MonsterDeathEventData): void => {
    if (event.world !== this.world || !event.killerId) return;
    // No protocolo antigo o jogador que matou recebe monsterDied,
    // e todos recebem o despawn pelo DeathSystem (uma única vez).
    if (this.world.players.some((player) => player.id === event.killerId)) {
      this.transport.sendToPlayer(event.killerId, JSON.stringify({
        type: "monsterDied",
        monsterId: event.monsterId,
      }));
    }
  };

  private disposed = false;

  constructor(
    private readonly world: World,
    private readonly transport: CombatEventTransport,
  ) {
    this.events.on<CombatDamageEventData>(GameEvent.COMBAT_DAMAGE, this.onDamage);
    this.events.on<MonsterDeathEventData>(GameEvent.MONSTER_DEATH, this.onMonsterDeath);
  }

  /** Cancela listeners quando o WebSocketServer é encerrado (testes/restart). */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.events.off(GameEvent.COMBAT_DAMAGE, this.onDamage);
    this.events.off(GameEvent.MONSTER_DEATH, this.onMonsterDeath);
  }
}
