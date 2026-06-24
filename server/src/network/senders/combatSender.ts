// server/src/network/senders/combatSender.ts
import { BaseSender } from "./base/baseSender";

export class CombatSender extends BaseSender {
  /**
   * Envia a posição atualizada do jogador.
   */
  sendPosition(x: number, y: number): void {
    this.send({ type: "position", x, y });
  }

  /**
   * Envia dano causado a um alvo.
   */
  sendDamage(targetId: string, newHp: number, maxHp: number, damage: number): void {
    this.send({ type: "damage", targetId, newHp, maxHp, damage });
  }

  /**
   * Notifica o cliente que o ataque automático foi interrompido.
   */
  sendAutoAttackStopped(reason: string): void {
    this.send({ type: "autoAttackStopped", reason });
  }

  /**
   * Notifica o cliente que o ataque falhou.
   */
  sendAttackFailed(reason: string): void {
    this.send({ type: "attackFailed", reason });
  }

  /**
   * Notifica o cliente que o ataque automático foi iniciado.
   */
  sendAutoAttackStarted(targetId: string): void {
    this.send({ type: "autoAttackStarted", targetId });
  }

  /**
   * Notifica o cliente que um monstro morreu.
   */
  sendMonsterDied(monsterId: string): void {
    this.send({ type: "monsterDied", monsterId });
  }
}
