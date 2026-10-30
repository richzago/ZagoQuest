# API account authorization (ZagoQuest)

## Scope

HTTP authentication uses the signed JWT created by `SessionService.login()`, containing `{ id: accountId, email }`. The REST middleware verifies the signature **and** requires a nonempty string `id`.

`CharacterController` uses this verified account ID for both creation and listing. A client-supplied `accountId` is **not** an authorization credential.

| Request | Response |
| --- | --- |
| Valid JWT, matching body `accountId` | 201 on successful create |
| Valid JWT, omitted body `accountId` | 201 on successful create (JWT chooses account) |
| Valid JWT, another body `accountId` | 403, no mutation |
| Valid JWT, matching `/account/:accountId` | 200, own characters |
| Valid JWT, another account's URL | 403, no query |
| Missing/invalid JWT or JWT lacking `id` | 401 |

Existing clients that already pass their own account ID continue working. Clients can now omit the account ID in POST to avoid redundant state. No Unity WebSocket message or account login response was modified.

## Test coverage

`server/tests/apiAuthorization.test.ts` tests signed JWT payload validation, missing/forged tokens, own and foreign account paths, legacy body field and missing session. Tests stub the character service so they require neither PostgreSQL nor Unity.

From `server/`:

```bash
npm ci
npm run build
npm test
```

## Security remains incomplete

This is **not** a public-multiplayer security release. The WebSocket still binds to `world.players[0]` and does not authenticate character sessions; guild mutations still trust the client-provided `characterName`; production database migrations and operational hardening are separate tasks. Keep the server private until these areas are addressed.

Review: [Notion server audit](https://app.notion.com/p/409ec07d7c4f8158ae8cf46c4b10ac2c).
