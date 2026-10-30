# WorldFactory error boundaries

`createWorldAndPlayer()` loads a Tiled map and then materializes monster/NPC spawns. Previously a single `try/catch` wrapped **all three** operations. When a MonsterLoader or NpcLoader error propagated, the error was logged as an invalid Tiled map and `World.generateMap()` silently replaced the world with a procedural fallback.

Now only errors emitted by `MapLoader.loadMap()` trigger the fallback. MonsterLoader/NpcLoader failures propagate to the bootstrap lifecycle handler, which stops startup and cleans up resources rather than hiding a broken registry/configuration.

Unit tests stub the three loader boundaries and verify: malformed Tiled → safe fallback; monster error → reject; NPC error → reject; valid map → uses correct spawn and initializes both loaders. No PostgreSQL required.

**Still pending:** MapLoader runtime schema validation, safe asset paths in packaged `dist`, reporting individual malformed spawns and guaranteeing atomicity of partial entity addition. This change prevents silently continuing on a broken world but does not add transactional world loading.

Run `cd server && npm ci && npm run build && npm test`. [Notion audit](https://app.notion.com/p/409ec07d7c4f8158ae8cf46c4b10ac2c).