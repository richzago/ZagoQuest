/**
 * skillType.enum.ts
 *
 * Tipos de habilidades (skills) disponíveis para o jogador.
 * Cada skill está associada a um estilo de combate ou atividade.
 *
 * @module shared/enums/SkillType
 */

export enum SkillType {
  /** Espada – aumenta dano com espadas */
  SWORD = "sword",

  /** Machado – aumenta dano com machados */
  AXE = "axe",

  /** Clava – aumenta dano com clavas */
  CLUB = "club",

  /** Distância – aumenta dano com arcos/bestas */
  DISTANCE = "distance",

  /** Escudo – aumenta defesa quando equipado */
  SHIELDING = "shielding",

  /** Nível de magia – aumenta dano de feitiços (futuro) */
  MAGIC_LEVEL = "magicLevel",

  /** Pesca – aumenta chance de peixes raros */
  FISHING = "fishing",
}
