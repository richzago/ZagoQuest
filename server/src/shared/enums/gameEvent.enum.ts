/**
 * Eventos globais do sistema (usados pelo EventSystem)
 */
export enum GameEvent {
  // Monstros
  MONSTER_DEATH = "monster:death",
  MONSTER_SPAWN = "monster:spawn",

  // Jogador
  PLAYER_DEATH = "player:death",
  PLAYER_LEVEL_UP = "player:levelUp",
  PLAYER_GAIN_XP = "player:gainXp",

  // Inventário / Itens
  ITEM_PICKUP = "item:pickup",
  ITEM_DROP = "item:drop",
  ITEM_USE = "item:use",

  // Combate
  COMBAT_DAMAGE = "combat:damage",
  COMBAT_KILL = "combat:kill",
}
