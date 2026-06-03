/**
 * cooldownManager.ts
 *
 * Gerencia cooldowns de ações (ataques, magias, itens, etc.) para uma entidade.
 *
 * @module game/combat/CooldownManager
 */

import { Logger } from "../core/logger/logger";

/**
 * Gerencia cooldowns de ações para uma entidade (Player, Monster).
 * Cada ação é identificada por uma string (ex: "attack", "spell_fireball").
 *
 * @example
 * ```typescript
 * const cooldownManager = new CooldownManager();
 * if (cooldownManager.isReady("attack", 1000)) {
 *   cooldownManager.addCooldown("attack", 1000);
 *   // executar ataque
 * }
 * ```
 */
export class CooldownManager {
  /** Mapa de cooldowns ativos: actionId -> timestamp de expiração (ms) */
  private cooldowns: Map<string, number> = new Map();

  /**
   * Verifica se uma ação está disponível (fora de cooldown).
   *
   * @param actionId - Identificador da ação (ex: "attack", "spell_heal")
   * @param cooldownMs - Tempo de cooldown em milissegundos (padrão 0)
   * @returns `true` se a ação pode ser executada, `false` caso contrário
   *
   * @remarks
   * Se `cooldownMs` for fornecido, a função verifica se o tempo decorrido desde a última execução
   * é maior ou igual ao cooldown. Caso contrário, usa o cooldown armazenado (se houver).
   *
   * @example
   * ```typescript
   * if (cooldownManager.isReady("attack", 1000)) {
   *   console.log("Pode atacar!");
   * }
   * ```
   */
  isReady(actionId: string, cooldownMs: number = 0): boolean {
    const expiresAt = this.cooldowns.get(actionId);
    if (!expiresAt) return true;
    const now = Date.now();
    if (now >= expiresAt) {
      // Limpa cooldown expirado
      this.cooldowns.delete(actionId);
      return true;
    }
    return false;
  }

  /**
   * Adiciona (ou reinicia) um cooldown para uma ação.
   *
   * @param actionId - Identificador da ação
   * @param cooldownMs - Tempo de cooldown em milissegundos (deve ser positivo)
   * @returns {void}
   *
   * @remarks
   * Se `cooldownMs` for menor ou igual a zero, o cooldown não é aplicado.
   *
   * @example
   * ```typescript
   * cooldownManager.addCooldown("attack", 1000);
   * ```
   */
  addCooldown(actionId: string, cooldownMs: number): void {
    if (cooldownMs <= 0) return;
    const expiresAt = Date.now() + cooldownMs;
    this.cooldowns.set(actionId, expiresAt);
    Logger.combat(`Cooldown iniciado para ${actionId}: ${cooldownMs}ms`);
  }

  /**
   * Remove um cooldown ativo (útil para cancelar ou resetar).
   *
   * @param actionId - Identificador da ação
   * @returns `true` se o cooldown existia e foi removido, `false` caso contrário
   *
   * @example
   * ```typescript
   * cooldownManager.removeCooldown("attack");
   * ```
   */
  removeCooldown(actionId: string): boolean {
    return this.cooldowns.delete(actionId);
  }

  /**
   * Retorna o tempo restante (em ms) para uma ação.
   *
   * @param actionId - Identificador da ação
   * @returns Tempo restante em milissegundos (0 se não houver cooldown)
   *
   * @example
   * ```typescript
   * const remaining = cooldownManager.getRemainingTime("attack");
   * if (remaining > 0) console.log(`Aguardar ${remaining}ms`);
   * ```
   */
  getRemainingTime(actionId: string): number {
    const expiresAt = this.cooldowns.get(actionId);
    if (!expiresAt) return 0;
    const remaining = expiresAt - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Retorna todos os cooldowns ativos (para depuração).
   *
   * @returns Mapa de actionId -> tempo restante (ms)
   */
  getAllActive(): Map<string, number> {
    const result = new Map<string, number>();
    for (const [actionId, expiresAt] of this.cooldowns) {
      const remaining = expiresAt - Date.now();
      if (remaining > 0) result.set(actionId, remaining);
    }
    return result;
  }

  /**
   * Limpa todos os cooldowns (útil ao morrer ou reiniciar estado).
   */
  clear(): void {
    this.cooldowns.clear();
  }
}
