/**
 * C18 — personagem + itens do chão persistidos no MESMO commit PostgreSQL.
 * Uso exclusivo nos handlers drop/pickup. Não é transação de inventário
 * universal: shop, loot e fishing ainda seguem persistência própria.
 */
import { AppDataSource } from "../../api/data-source";
import { Player } from "../entities/player";
import type { World } from "../world/World";
import { DatabasePersistence } from "./databasePersistence";
import { GroundItemPersistence } from "./groundItemPersistence";
import { withCharacterWriteLock } from "./characterWriteLock";
import { Logger } from "../core/logger/logger";

export class GroundCharacterTransaction {
  static async execute(world: World, player: Player, mutate: () => boolean):
      Promise<boolean> {
    // Testes unitários sem Postgres preservam a semântica anterior.
    if (!AppDataSource.isInitialized) return mutate();
    return withCharacterWriteLock(player.id, async () => {
      // Impede que writes do chão feitos ANTES do drop/pickup sobrescrevam
      // o snapshot do commit desta operação.
      await GroundItemPersistence.waitForPending(world);
      const previousItems = [...world.itemsOnGround];
      const oldBags = player.exportBagState();
      const oldItems = new Map(player.inventory);
      const oldEquipment = new Map(player.equipment);
      const oldGold = player.gold, oldBank = player.bankGold;
      const previousView = player.getViewedBagInstanceId();
      const resume = GroundItemPersistence.suspendWrites(world);
      const rollback = () => {
        world.itemsOnGround.splice(0,world.itemsOnGround.length,...previousItems);
        player.equipment = new Map(oldEquipment);
        player.inventory = new Map(oldItems);
        player.restoreBagState(oldBags);
        player.restoreBagView(previousView);
        player.gold=oldGold;player.bankGold=oldBank;
        player.recalculateStats();
      };
      try {
        if (!mutate()) { rollback(); return false; }
        const ground = GroundItemPersistence.serialize(world);
        await AppDataSource.transaction(async manager => {
          await DatabasePersistence.saveCharacterWithManager(player,manager);
          await GroundItemPersistence.saveSnapshotWithManager(manager,ground);
        });
        return true;
      } catch(error) {
        rollback();
        Logger.error("[C18][ATOMIC] Rollback personagem+chão: "+String(error));
        return false;
      } finally { resume(); }
    });
  }
}
