# Character persistence identity

Before this change, `DatabasePersistence.saveCharacter(player)` located a row by `player.name`, which is display information and may change. In future rename or stale-memory scenarios, name-based lookup risks updating another row or using an unintended identity.

Autosave and shutdown now query `Character.id === player.id` (UUID), which is the stable identity originally loaded from PostgreSQL. When a matching row exists, its state is updated. When no matching row exists, the historical behavior of creating a new row using the player's UUID remains.

**Explicit decision:** autosave does **not** rename an existing database character. A dedicated character-rename command should validate uniqueness and update relevant references and in-memory state.

Regression tests in `server/tests/characterPersistence.test.ts` use a repository stub to verify lookup criteria, newly-created UUID and in-place update of existing row. Run `cd server && npm ci && npm run build && npm test`.

Follow-up work: validate JSONB inventory, equipment and skill values on load; enforce correct UUIDs; handle concurrent saves and duplicate sessions; add PostgreSQL integration tests.
