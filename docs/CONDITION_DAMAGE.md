# Condition damage and death (PR #16)

## Bug

`ConditionManager.onTick()` previously called `target.takeDamage()` directly. A poison/burn tick that reduced a monster to zero could bypass `COMBAT_DAMAGE`, `DeathSystem.handleDeath()`, XP, loot/corpse, and the normal network event bridge.

## Fix

- `World.addPlayer/addMonster/addNpc` binds the creature's condition manager to its owning World.
- `Condition` stores the source that applied the effect. Reapplying updates duration **and** source.
- `CombatSystem.applyPeriodicDamage()` handles real HP loss (no negative, NaN, overkill or attacking skill gain), emits `COMBAT_DAMAGE` in that World, and invokes `DeathSystem` once if the target dies. Player stats are sent via the existing sender.
- `DeathSystem` clears periodic effects upon a player or monster death so they cannot tick on a dead or respawned creature.
- The normal `CONDITION_TICK` event still reports the actual damage.

## Tests

`server/tests/conditionDeath.test.ts` verifies event attribution and HP, fatal poison granting XP and one corpse, player death/respawn with the condition cleared, and source refresh. Use `cd server && npm ci && npm run build && npm test`.

## Remaining design choices

The prototype still uses one `setInterval` per active DoT and duration expiration is updated by the main game loop (`GAME_TICK_MS = 1500`), so timer scheduling and duration are not perfectly synchronized. A future targeted change can move condition timers into the world tick or a dedicated scheduler **with deterministic clock tests**. This PR intentionally preserves the current tick intervals and client messages.

Detached creatures (not inserted into a World) cannot resolve death/XP consistently; the periodic manager skips damage until bound. Reapplying a condition replaces its damage source, by design.

See [Notion audit](https://app.notion.com/p/409ec07d7c4f8158ae8cf46c4b10ac2c).