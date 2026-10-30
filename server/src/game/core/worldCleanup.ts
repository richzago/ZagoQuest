/**
 * Removes volatile world resources that would otherwise keep Node running:
 * condition effect intervals, fishing timeout, corpse/respawn timers and
 * in-memory NPC interactions. Called AFTER the game loop and WS command
 * processing stop, BEFORE final save and DB shutdown.
 */
import type { World } from "../world/World";
import { DeathSystem } from "../systems/deathSystem";
import { NpcInteractionSystem } from "../systems/npcInteractionSystem";

export function stopWorldRuntime(world: World): void {
  // Pending corpse expiration and monster respawn must never fire post-shutdown.
  DeathSystem.cancelPendingTimers(world);

  for (const creature of [...world.players, ...world.monsters, ...world.npcs]) {
    creature.conditionManager.clear();
    creature.cooldownManager.clear();
  }

  for (const player of world.players) {
    if (player.fishingTimer) {
      clearTimeout(player.fishingTimer);
      player.fishingTimer = undefined;
    }
    player.isFishing = false;
    player.currentTargetId = undefined;
    NpcInteractionSystem.close(player);
  }
}
