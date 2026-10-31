/**
 * C6: alimentação autoritativa com regras configuráveis em itens JSON.
 *
 * foodSeconds: duração limitada do efeito daquele alimento.
 * satietyPoints: quanto enche a barriga (capacidade de 120 pontos).
 * regenHpPerTick / regenManaPerTick / regenTickSeconds: regeneração LEVE,
 * distinta de poções instantâneas. Cada alimento mantém sua própria regra
 * mesmo quando consumido junto de outro (fila, sem stacking simultâneo).
 *
 * Nada disso executa no Unity. HP/mana seguem persistência do personagem;
 * a saciedade é transitória e termina ao expirar a última porção.
 */
import type { Player } from "../entities/player";

export const MAX_FOOD_SECONDS = 120;
export const MAX_SATIETY_POINTS = 120;
// Valores de compatibilidade para chamadas antigas: itens devem definir JSON.
export const FOOD_TICK_MS = 3000;
export const FOOD_HP_PER_TICK = 1;
export const FOOD_MANA_PER_TICK = 1;

interface FoodPortion {
  endAt: number;
  nextTickAt: number;
  tickIntervalMs: number;
  hpPerTick: number;
  manaPerTick: number;
}
interface NourishmentState {
  satietyPoints: number;
  portions: FoodPortion[];
}

const activeFood = new WeakMap<Player, NourishmentState>();

export class FoodRegenerationSystem {
  /**
   * Confere capacidade e tempo ANTES de consumir item. Não admite efeito
   * parcial e nunca concede saciedade/HP/mana a personagem morto.
   */
  static canEat(
    player: Player, foodSeconds: number, nowMs = Date.now(),
    satietyPoints = foodSeconds, hpPerTick = FOOD_HP_PER_TICK,
    manaPerTick = FOOD_MANA_PER_TICK, tickSeconds = FOOD_TICK_MS / 1000,
  ): boolean {
    if (player.hp <= 0 || !Number.isSafeInteger(foodSeconds) || foodSeconds <= 0 ||
        foodSeconds > MAX_FOOD_SECONDS ||
        !Number.isSafeInteger(satietyPoints) || satietyPoints <= 0 ||
        satietyPoints > MAX_SATIETY_POINTS ||
        !Number.isSafeInteger(hpPerTick) || hpPerTick < 0 || hpPerTick > 10 ||
        !Number.isSafeInteger(manaPerTick) || manaPerTick < 0 || manaPerTick > 10 ||
        hpPerTick + manaPerTick <= 0 ||
        !Number.isSafeInteger(tickSeconds) || tickSeconds <= 0 ||
        tickSeconds > foodSeconds) return false;

    const current = activeFood.get(player);
    const end = current?.portions[current.portions.length - 1]?.endAt ?? 0;
    const isActive = end > nowMs;
    const currentSatiety = isActive ? current!.satietyPoints : 0;
    const remainingSeconds = isActive ? (end - nowMs) / 1000 : 0;

    // Quando enche, não pode comer novamente até o efeito de TODAS
    // as porções terminar. Um alimento que não cabe é recusado inteiro.
    return currentSatiety + satietyPoints <= MAX_SATIETY_POINTS &&
      remainingSeconds + foodSeconds <= MAX_FOOD_SECONDS;
  }

  /**
   * Só chamar depois de o handler validar e remover uma unidade.
   * Cada porção guarda sua própria taxa para não receber buffs retroativos.
   */
  static feed(
    player: Player, foodSeconds: number, nowMs = Date.now(),
    satietyPoints = foodSeconds, hpPerTick = FOOD_HP_PER_TICK,
    manaPerTick = FOOD_MANA_PER_TICK, tickSeconds = FOOD_TICK_MS / 1000,
  ): void {
    if (!this.canEat(player, foodSeconds, nowMs, satietyPoints,
                     hpPerTick, manaPerTick, tickSeconds)) return;
    const previous = activeFood.get(player);
    const tail = previous?.portions[previous.portions.length - 1];
    const active = tail != null && tail.endAt > nowMs;
    const startAt = active ? tail.endAt : nowMs;
    const portions = active ? previous!.portions : [];
    const interval = tickSeconds * 1000;
    portions.push({
      endAt: startAt + foodSeconds * 1000,
      nextTickAt: startAt + interval,
      tickIntervalMs: interval,
      hpPerTick,
      manaPerTick,
    });
    activeFood.set(player, {
      satietyPoints: (active ? previous!.satietyPoints : 0) + satietyPoints,
      portions,
    });
  }

  static currentSatiety(player: Player, nowMs = Date.now()): number {
    const state = activeFood.get(player);
    if (!state?.portions.length ||
        state.portions[state.portions.length - 1].endAt <= nowMs) return 0;
    return state.satietyPoints;
  }

  static remainingSeconds(player: Player, nowMs = Date.now()): number {
    const state = activeFood.get(player);
    const expiresAt = state?.portions[state.portions.length - 1]?.endAt ?? 0;
    return Math.max(0, Math.ceil((expiresAt - nowMs) / 1000));
  }

  /**
   * Executado pelo loop do Node. Avanço por timestamps, portanto funciona
   * mesmo se um tick do mundo atrasar. Processa apenas porções vencidas,
   * sem dobrar healing por número de frames e sem ultrapassar maxHp/maxMana.
   */
  static tick(player: Player, nowMs = Date.now()): boolean {
    const state = activeFood.get(player);
    if (!state) return false;
    if (player.hp <= 0) {
      activeFood.delete(player);
      return false;
    }

    const hpBefore = player.hp;
    const manaBefore = player.mana;
    while (state.portions.length > 0) {
      const portion = state.portions[0];
      const cutoff = Math.min(nowMs, portion.endAt);
      if (cutoff >= portion.nextTickAt) {
        const ticks = Math.min(
          MAX_FOOD_SECONDS, Math.floor((cutoff - portion.nextTickAt) /
          portion.tickIntervalMs) + 1,
        );
        player.hp = Math.min(player.maxHp, player.hp + ticks * portion.hpPerTick);
        player.mana = Math.min(player.maxMana, player.mana + ticks * portion.manaPerTick);
        portion.nextTickAt += ticks * portion.tickIntervalMs;
      }
      if (nowMs < portion.endAt) break;
      state.portions.shift();
    }
    const ended = state.portions.length === 0;
    if (ended) activeFood.delete(player);
    // Mesmo com HP/mana cheios, atualizar Status quando a barriga esvaziar.
    return ended || player.hp !== hpBefore || player.mana !== manaBefore;
  }
}
