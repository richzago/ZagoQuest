# Authorization of guild HTTP mutations

Routes `POST /api/guilds`, `PUT /api/guilds/:guildName/description`, `PUT /api/guilds/:guildName/profile-image`, `PUT /api/guilds/:guildName/cover-image` now check:

1. A signed JWT was decoded by `authMiddleware` into an account ID.
2. The `characterName` in the body belongs to **that account**, using `Character.accountId` in PostgreSQL.
3. For guild edits, the URL `:guildName` matches the guild to which that character belongs.
4. Existing `GuildService` leader-role rules still apply for edits.

| Failure | Response |
| --- | --- |
| No authenticated session | 401 |
| Missing/invalid characterName | 400 |
| Character belongs to another account | 403 |
| Guild URL does not correspond to character guild | 403 |
| Character owns guild and meets role rules | Domain operation |

This is defense-in-depth. Trust is established from the JWT, not from a name supplied by Unity or an arbitrary client. A separate future PR must make guild creation *transactional*; ownership checks alone do not prevent a partially committed purchase.

`tests/guildAuthorization.test.ts` verifies forbidden cross-account and cross-guild operations and valid requests without opening PostgreSQL. A real PostgreSQL integration test should follow to verify account relations and transactions.

Run from `server/`: `npm ci && npm run build && npm test`.

**Not addressed**: WebSocket login and character sessions; guild transaction rollback; validating URLs for profile images; rate limiting; production migrations.

See [Notion server audit](https://app.notion.com/p/409ec07d7c4f8158ae8cf46c4b10ac2c).
