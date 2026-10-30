/**
 * Curva de XP do ZagoQuest — altere estes valores para balancear o jogo.
 * XP é acumulativo; não se desconta ao subir de nível.
 *
 * Os números são menores que os do Tibia. A dificuldade real também depende
 * do XP atribuído a cada monstro, em data/monsters/.
 */
export const EXPERIENCE_CONFIG = {
  base: 100,         // Garante 100 XP acumulados para alcançar o level 2.
  growth: 15,        // Aumenta a exigência nos níveis iniciais/intermediários.
  curveDivisor: 800, // Quanto MENOR, mais difícil a progressão em níveis altos.
  maxLevel: 5000,    // Mantém XP abaixo do limite INT4 do PostgreSQL.
} as const;

/** XP TOTAL necessário para ALCANÇAR um nível (level 1 = 0 XP). */
export function totalXpForLevel(level: number): number {
  if (!Number.isSafeInteger(level) || level < 1 || level > EXPERIENCE_CONFIG.maxLevel) {
    throw new RangeError("Nível fora dos limites da curva de XP.");
  }

  const n = level - 1;
  return (
    EXPERIENCE_CONFIG.base * n +
    EXPERIENCE_CONFIG.growth * n * (n - 1) +
    Math.floor(n ** 3 / EXPERIENCE_CONFIG.curveDivisor)
  );
}
