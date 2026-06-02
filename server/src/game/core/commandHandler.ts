/**
 * commandHandler.ts
 *
 * Mapeamento de teclas para ações imediatas (movimento, ataque, loot, menus, etc.).
 * Cada função recebe (player, world, ...args) e executa a ação correspondente.
 *
 * @module game/core/commandHandler
 */

import { Player } from "../entities/player";
import { World } from "../world/World";
import { Npc } from "../entities/npc";
import { CombatSystem } from "../combat/combatSystem";
import { FishingSystem } from "../systems/fishingSystem";
import { PersistenceSystem } from "../systems/persistenceSystem";
import { ItemRegistry } from "../../data/items/itemRegistry";
import { ShopSystem } from "../systems/shopSystem";
import { BankingSystem } from "../systems/bankingSystem";
import { showMenu } from "./menuSystem";
import { Logger } from "./logger/logger";

// ------------------------------------------------------------
// Utilitário para cancelar pesca antes de mover
// ------------------------------------------------------------
function cancelFishingIfNeeded(player: Player) {
  if (player.isFishing) {
    FishingSystem.cancelFishing(player);
  }
}

// ------------------------------------------------------------
// Movimento (8 direções)
// ------------------------------------------------------------
function moveUp(player: Player, world: World) {
  cancelFishingIfNeeded(player);
  player.move(0, -1, world);
}
function moveDown(player: Player, world: World) {
  cancelFishingIfNeeded(player);
  player.move(0, 1, world);
}
function moveLeft(player: Player, world: World) {
  cancelFishingIfNeeded(player);
  player.move(-1, 0, world);
}
function moveRight(player: Player, world: World) {
  cancelFishingIfNeeded(player);
  player.move(1, 0, world);
}
function moveUpLeft(player: Player, world: World) {
  cancelFishingIfNeeded(player);
  player.move(-1, -1, world);
}
function moveUpRight(player: Player, world: World) {
  cancelFishingIfNeeded(player);
  player.move(1, -1, world);
}
function moveDownLeft(player: Player, world: World) {
  cancelFishingIfNeeded(player);
  player.move(-1, 1, world);
}
function moveDownRight(player: Player, world: World) {
  cancelFishingIfNeeded(player);
  player.move(1, 1, world);
}

// ------------------------------------------------------------
// Ação de ataque corpo a corpo (tecla 'f')
// ------------------------------------------------------------
function attack(player: Player, world: World) {
  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: -1 },
  ];
  let targetMonster = null;
  for (const dir of directions) {
    const x = player.position.x + dir.dx;
    const y = player.position.y + dir.dy;
    const monster = world.getMonsterAt(x, y);
    if (monster && monster.hp > 0) {
      targetMonster = monster;
      break;
    }
  }
  if (targetMonster) {
    CombatSystem.attack(player, targetMonster, world);
  } else {
    Logger.combat("Nenhum monstro adjacente para atacar.");
  }
}

// ------------------------------------------------------------
// Loot de corpos em área (tecla 'g')
// ------------------------------------------------------------
function lootCorpses(player: Player, world: World) {
  const positionsToCheck = [
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: -1 },
  ];
  let anyCorpseFound = false;
  for (const offset of positionsToCheck) {
    const x = player.position.x + offset.dx;
    const y = player.position.y + offset.dy;
    const corpse = world.getCorpseAt(x, y);
    if (!corpse) continue;
    anyCorpseFound = true;
    if (corpse.loot.length === 0) {
      world.removeCorpse(corpse);
      Logger.loot(`Corpo vazio removido em (${x}, ${y}).`);
      continue;
    }
    for (const item of corpse.loot) {
      player.addItem(item.itemId, item.amount);
      Logger.loot(`+${item.amount}x ${item.itemId} (corpo em ${x}, ${y})`);
    }
    world.removeCorpse(corpse);
    Logger.loot(`💀 Corpo saqueado em (${x}, ${y})!`);
  }
  if (!anyCorpseFound) {
    Logger.loot("Nenhum corpo próximo para saquear.");
  }
}

// ------------------------------------------------------------
// Equipar o primeiro item equipável do inventário (tecla 'e')
// ------------------------------------------------------------
function equipFirstItem(player: Player, _world: World) {
  let itemToEquip: string | null = null;
  for (const [itemId] of player.inventory) {
    const item = ItemRegistry.get(itemId);
    if (item && item.type === "equipment") {
      itemToEquip = itemId;
      break;
    }
  }
  if (itemToEquip) {
    player.equipItem(itemToEquip);
  } else {
    Logger.system("Nenhum item equipável no inventário.");
  }
}

// ------------------------------------------------------------
// Mostrar inventário (tecla 'i')
// ------------------------------------------------------------
function showInventory(player: Player, _world: World) {
  player.showInventory();
}

// ------------------------------------------------------------
// Mostrar equipamentos e atributos (tecla 'p')
// ------------------------------------------------------------
function showEquipment(player: Player, _world: World) {
  player.showEquipment();
}

// ------------------------------------------------------------
// Mostrar skills (tecla 'l')
// ------------------------------------------------------------
function showSkills(player: Player, _world: World) {
  const skills = Array.from(player.skills.entries())
    .map(([type, { level, progress }]) => `${type}: ${level} (${progress.toFixed(1)}%)`)
    .join(", ");
  Logger.skill(`📈 Skills: ${skills}`);
}

// ------------------------------------------------------------
// Pescar (tecla 'r') – o FishingSystem detecta vara/isca automaticamente
// ------------------------------------------------------------
function fish(player: Player, world: World) {
  FishingSystem.startFishing(player, world);
}

// ------------------------------------------------------------
// Salvar e sair do jogo (tecla 'x')
// ------------------------------------------------------------
function saveAndExit(player: Player, _world: World) {
  Logger.system("Salvando progresso...");
  PersistenceSystem.savePlayerSync(player);
  Logger.system("👋 Encerrando jogo...");
  process.exit(0);
}

// ------------------------------------------------------------
// Abertura do menu do comerciante (tecla 't')
// ------------------------------------------------------------
function openMerchantMenu(player: Player, world: World) {
  const adjacent = [
    world.getNpcAt(player.position.x + 1, player.position.y),
    world.getNpcAt(player.position.x - 1, player.position.y),
    world.getNpcAt(player.position.x, player.position.y + 1),
    world.getNpcAt(player.position.x, player.position.y - 1),
  ].find((n) => n && n.npcType === "merchant");

  if (!adjacent) {
    Logger.economy("Nenhum comerciante por perto.");
    return;
  }
  if (!adjacent.shopItems || adjacent.shopItems.length === 0) {
    Logger.warn("Este comerciante não tem itens no momento.");
    return;
  }
  const options = adjacent.shopItems.map((item) => ({
    label: `${item.itemId} (${item.buyPrice}g)`,
    action: (p: Player, npc: Npc) => ShopSystem.buyItem(p, npc, item.itemId, 1),
  }));
  showMenu(player, adjacent, options);
}

// ------------------------------------------------------------
// Abertura do menu do banqueiro (tecla 'b')
// ------------------------------------------------------------
function openBankerMenu(player: Player, world: World) {
  const adjacent = [
    world.getNpcAt(player.position.x + 1, player.position.y),
    world.getNpcAt(player.position.x - 1, player.position.y),
    world.getNpcAt(player.position.x, player.position.y + 1),
    world.getNpcAt(player.position.x, player.position.y - 1),
  ].find((n) => n && n.npcType === "banker");

  if (!adjacent) {
    Logger.economy("Nenhum banqueiro por perto.");
    return;
  }
  const options = [
    { label: "Depositar 100 gold", action: (p: Player) => BankingSystem.depositGold(p, 100) },
    { label: "Sacar 100 gold", action: (p: Player) => BankingSystem.withdrawGold(p, 100) },
    { label: "Ver saldo", action: (p: Player) => BankingSystem.checkBalance(p) },
  ].map((opt) => ({
    ...opt,
    action: (p: Player, _npc: Npc) => opt.action(p),
  }));
  showMenu(player, adjacent, options);
}

// ------------------------------------------------------------
// Mapeamento público de teclas para comandos
// ------------------------------------------------------------
export const immediateCommands: Record<string, (player: Player, world: World) => void> = {
  // Movimento
  w: moveUp,
  s: moveDown,
  a: moveLeft,
  d: moveRight,
  q: moveUpLeft,
  e: moveUpRight,
  z: moveDownLeft,
  c: moveDownRight,
  // Ações
  f: attack,
  g: lootCorpses,
  i: showInventory,
  p: showEquipment,
  l: showSkills,
  r: fish,
  x: saveAndExit,
  // Menus
  t: openMerchantMenu,
  b: openBankerMenu,
};
