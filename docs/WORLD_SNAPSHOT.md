# Initial world snapshot and corpse synchronization

New WebSocket clients receive an initial series of `spawn` messages through `WorldStateSender`. Prior to this fix, it included monsters, NPCs and dropped items, but skipped corpses created before connection. Those corpses would be invisible to a reconnecting client until they disappeared.

The snapshot now includes all corpses with **the same JSON shape** as `BroadcastService.broadcastSpawnCorpse`:

```json
{ "type": "spawn", "id": "corpse-1", "name": "Corpse", "x": 2, "y": 3 }
```

No new wire message or Unity handler is introduced. Regression tests verify the existing corpse is sent and the snapshot matches the broadcast byte-level JSON fields.

For future multiplayer, snapshot filtering by player viewport and corpse visibility/access rules remain necessary. Run `cd server && npm ci && npm run build && npm test`.

[Notion audit](https://app.notion.com/p/409ec07d7c4f8158ae8cf46c4b10ac2c).