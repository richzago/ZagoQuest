# Transactional guild creation

Creating a guild changes three related records: **Character.gold**, **Guild**, and **GuildMember**. They must either all be persisted or none persisted.

`GuildService.createGuild()` now runs the entire purchase inside a single `AppDataSource.transaction()`. It takes a PostgreSQL `pessimistic_write` lock on the character row, preventing concurrent guild purchases from using the same balance within this service.

The transaction:
1. Validates character exists and does not already belong to a guild.
2. Rejects a duplicate guild name (also protected by the `Guild.name` unique database constraint).
3. Checks level >= 100 and gold >= 20,000.
4. Debits gold, creates the guild with its initial log, creates the leader membership and commits.
5. Emits success logs **after** the commit.

A failed entity insert aborts the transaction, so no partial debit, guild or leader should survive.

## Regression tests

`server/tests/guildTransaction.test.ts` uses a simulated transactional unit of work to verify the order of operations, lock request and rollback semantics when guild or member save fails. Run:

```bash
cd server
npm ci
npm run build
npm test
```

**Required integration validation before merging:** PostgreSQL transaction rollback under actual constraint failures, two simultaneous requests from one character, duplicate guild name, and account authorization.

## Important remaining architectural risk

The current game server loads a `Player` into memory and separately autosaves its gold. An HTTP guild purchase changes the PostgreSQL row without necessarily updating this live in-memory `Player`. A subsequent autosave could overwrite the bank transaction result. This PR addresses **database atomicity**, not cross-process synchronization.

Do not expose guild purchases in a public multiplayer deployment until the live player/session state and DB write model have been reconciled. More protections (unique guild membership constraint, migrations, account-authorized service entry points) remain planned.

Review: [Notion server audit](https://app.notion.com/p/409ec07d7c4f8158ae8cf46c4b10ac2c).
