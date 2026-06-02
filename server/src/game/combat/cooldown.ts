/**
 * Utilitário simples de cooldown.
 * Pode ser reutilizado para ataques, spells, etc.
 *
 * @module game/combat/Cooldown
 */
export class Cooldown {
  /**
   * Verifica se uma ação está disponível (fora de cooldown).
   *
   * @param lastTime - Timestamp da última execução (em ms)
   * @param cooldownMs - Tempo de cooldown em milissegundos
   * @returns `true` se o cooldown já passou, `false` caso contrário
   *
   * @example
   * ```typescript
   * if (Cooldown.isReady(lastAttackTime, 1000)) {
   *   // pode atacar novamente
   *   lastAttackTime = Cooldown.trigger();
   * }
   * ```
   */
  static isReady(lastTime: number, cooldownMs: number): boolean {
    return Date.now() - lastTime >= cooldownMs;
  }

  /**
   * Retorna o timestamp atual para ser usado como marca de cooldown.
   *
   * @returns Timestamp atual (Date.now())
   *
   * @example
   * ```typescript
   * const lastCast = Cooldown.trigger();
   * ```
   */
  static trigger(): number {
    return Date.now();
  }
}
