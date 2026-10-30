# NPC AI properties from Tiled

The `NPCSpawn` object can define optional numeric properties:

| Property | Purpose | Default |
| --- | --- | --- |
| `radius` | Max Manhattan wandering radius | 5 |
| `interactionRadius` | Distance beyond which an active conversation ends | 3 |
| `moveCooldown` | Milliseconds between AI movements | 1500 |

Precedence is `Tiled object` → NPC JSON `ai` → defaults. Values must be safe integers; radius and interactionRadius accept 0, while moveCooldown must be positive. Invalid values revert to a valid lower-priority source.

`MapLoader` now forwards these properties via `NpcSpawnData`. `NpcLoader` validates and applies them, and `NpcAI` uses the configured interaction distance instead of a hard-coded 3.

This does not redesign `NpcInteractionSystem` or multiplayer dialog sessions. It only fixes propagation of the settings already documented in the loader.

Tests create a temporary Tiled JSON map, spawn a real NPC from the local JSON and assert that distance-based conversation ending changes with `interactionRadius`, plus invalid-value fallback. Run `cd server && npm ci && npm run build && npm test`.

[Notion server audit](https://app.notion.com/p/409ec07d7c4f8158ae8cf46c4b10ac2c).