/**
 * Regeneração de comida autoritativa no Node (C6).
 *
 * Cada alimento define foodSeconds (regeneração) e satietyPoints (saciedade)\n * separadamente no JSON. Com 120 pontos, o jogador fica de barriga cheia\n * até terminar a regeneração restante. Enquanto durar,
 * cada 2 segundos recupera até 2 HP e 1 mana, respeitando os máximos atuais.
 * O tick usa tempo real e é chamado pelo loop do mundo; não cria timers por
 * jogador, não executa no Unity e não ressuscita personagens.
 *
 * O estado de saciedade é temporário (sessão em memória); HP/mana recuperados
 * são persistidos pelo autosave existente. Uma futura persistência de fome
 * exige migração/contrato próprios e não faz parte desta correção.
 */
import type { Player } from "../entities/player";

export const FOOD_TICK_MS = 2000;
export const MAX_FOOD_SECONDS = 120;
export const MAX_SATIETY_POINTS = 120;
export const FOOD_HP_PER_TICK = 2;
export const FOOD_MANA_PER_TICK = 1;

interface NourishmentState {
  expiresAt: number;
  nextTickAt: number;
  satietyPoints: number;
  /** Chegou exatamente ao limite: só pode comer após a saciedade terminar. */
  fullUntil?: number;
}

const activeFood = new WeakMap<Player, NourishmentState>();

export class FoodRegenerationSystem {
  /** Indica se um alimento válido ainda cabe na saciedade atual. */
  static canEat(player: Player, foodSeconds: number, nowMs = Date.now(), satietyPoints = foodSeconds): boolean {
    const current = activeFood.get(player);
    const remainingSeconds = Math.max(0, ((current?.expiresAt ?? 0) - nowMs) / 1000);
    const currentSatiety = remainingSeconds > 0 ? (current?.satietyPoints ?? 0) : 0;
    return player.hp > 0 &&
      Number.isSafeInteger(foodSeconds) && foodSeconds > 0 &&
      foodSeconds <= MAX_FOOD_SECONDS &&
      Number.isSafeInteger(satietyPoints) && satietyPoints > 0 &&
      satietyPoints <= MAX_SATIETY_POINTS &&
      currentSatiety + satietyPoints <= MAX_SATIETY_POINTS &&
      !(current?.fullUntil && nowMs < current.fullUntil) &&
      // Uma comida nunca é parcialmente desperdiçada para caber no teto.
      remainingSeconds + foodSeconds <= MAX_FOOD_SECONDS + 1e-6;
  }

  /** Alimenta apenas após o handler confirmar posse e consumir UMA unidade. */
  static feed(player: Player, foodSeconds: number, nowMs = Date.now(), satietyPoints = foodSeconds): void {
    if (!this.canEat(player, foodSeconds, nowMs, satietyPoints)) return;
    const current = activeFood.get(player);
    const remainingEnd = current && current.expiresAt > nowMs ? current.expiresAt : nowMs;
    const expiresAt = remainingEnd + foodSeconds * 1000;
    const totalSatiety = (remainingEnd > nowMs ? (current?.satietyPoints ?? 0) : 0) + satietyPoints;
    const becameFull = totalSatiety >= MAX_SATIETY_POINTS;
    activeFood.set(player, {
      expiresAt,
      satietyPoints: totalSatiety,
      // Ao ficar completamente saciado, bloqueia novo alimento até acabar
      // toda a regeneração. Não há "refill" aos poucos no intervalo.
      fullUntil: becameFull ? expiresAt : undefined,
      // Comer novamente acrescenta duração, sem reiniciar o tick.
      nextTickAt: current && current.expiresAt > nowMs
        ? current.nextTickAt : nowMs + FOOD_TICK_MS,
    });
  }

  /** Pontos atuais para feedback do chat; não é estado cliente-autoritativo. */
  static currentSatiety(player: Player, nowMs = Date.now()): number {
    const current = activeFood.get(player);
    return current && current.expiresAt > nowMs ? current.satietyPoints : 0;
  }

  /** Consulta para exibir mensagem, nunca para autorizar ações do cliente. */
  static remainingSeconds(player: Player, nowMs = Date.now()): number {
    const expiresAt = activeFood.get(player)?.expiresAt ?? 0;
    return Math.max(0, Math.ceil((expiresAt - nowMs) / 1000));
  }

  /**
   * Processa tempo decorrido, inclusive atraso moderado do loop, uma vez por
   * período de 2s (sem acelerar por tick de mundo de 250ms). Retorna true
   * somente quando HP/mana realmente muda, para evitar spam de playerStats.
   */
  static tick(player: Player, nowMs = Date.now()): boolean {
    const state = activeFood.get(player);
    if (!state) return false;
    if (player.hp <= 0) {
      activeFood.delete(player);
      return false;
    }

    const cutoff = Math.min(nowMs, state.expiresAt);
    if (cutoff < state.nextTickAt) {
      if (nowMs >= state.expiresAt) activeFood.delete(player);
      return false;
    }

    // No máximo 60 ticks de uma janela de 120s; tempo não gera infinitos ticks.
    const ticks = Math.min(
      MAX_FOOD_SECONDS * 1000 / FOOD_TICK_MS,
      Math.floor((cutoff - state.nextTickAt) / FOOD_TICK_MS) + 1,
    );
    state.nextTickAt += ticks * FOOD_TICK_MS;

    const hpBefore = player.hp;
    const manaBefore = player.mana;
    player.hp = Math.min(player.maxHp, player.hp + ticks * FOOD_HP_PER_TICK);
    player.mana = Math.min(player.maxMana, player.mana + ticks * FOOD_MANA_PER_TICK);

    if (nowMs >= state.expiresAt) activeFood.delete(player);
    return player.hp !== hpBefore || player.mana !== manaBefore;
  }
}
