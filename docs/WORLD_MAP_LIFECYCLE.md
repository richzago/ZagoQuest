# World map lifecycle

`World.generateMap(width, height)` is a local fallback for the Tiled map loader. Repeating the generation formerly retained coordinates and collision from previous maps because `tiles` was not cleared.

The method now validates positive safe-integer dimensions **before** altering state, resets `tiles` and creates a fresh walkable grid plus the fallback test wall at (5,5). `isWithinBounds` requires tile coordinates to be safe integers.

Regression tests cover regeneration from a large to small map and back, stale collision removal, invalid dimensions leaving the original world unchanged, and finite integer bounds.

The Tiled loader still needs separate input-schema validation and missing Collision handling. This PR does **not** introduce size limits for production maps, nor optimize spatial lookup. Implement these based on real map dimensions and profiling.

Run `cd server && npm ci && npm run build && npm test`. [Notion audit](https://app.notion.com/p/409ec07d7c4f8158ae8cf46c4b10ac2c).