/**
 * Utilitário simples de cooldown.
 * Pode ser reutilizado para ataques, spells, etc.
 */
export class Cooldown {
  /**
   * Verifica se ação está disponível.
   */
  static isReady(lastTime: number, cooldownMs: number): boolean {
    return Date.now() - lastTime >= cooldownMs;
  }

  /**
   * Atualiza timestamp do cooldown.
   */
  static trigger(): number {
    return Date.now();
  }
}
