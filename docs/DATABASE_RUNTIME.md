# Database runtime configuration

`AppDataSource` now resolves a conservative, testable PostgreSQL runtime policy.

| Variable | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | unset | Set `development` locally; `production` on deployed servers. |
| `DB_SYNCHRONIZE` | `false` | **Only** allowed when `NODE_ENV=development`. Both must be explicit to enable schema sync. |
| `DB_LOGGING` | `false` | Set `true` only when SQL diagnostics are needed. |
| `DB_PORT` | `5432` | Must be an integer from 1 to 65535. |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | development defaults | Configure per environment. |

## Local development

From the `server/` directory, copy `.env.example` to `.env` and set your own DB credentials and JWT secret. The example opts into schema synchronization **only for local development**.

```powershell
Copy-Item .env.example .env
npm ci
npm run build
npm test
npm run dev
```

Existing local `.env` files must set both `NODE_ENV=development` and `DB_SYNCHRONIZE=true` if they previously relied on unconditional TypeORM synchronization. Back up PostgreSQL before changing schema settings.

## Production warning

TypeORM `synchronize` can alter table schemas automatically. It is now disabled outside explicit development opt-in and `DB_SYNCHRONIZE=true` in production aborts initialization.

**Production deployment is still blocked** until reviewed, versioned TypeORM migrations are created and tested against a database copy. This PR deliberately does not silently generate migrations or modify existing data.

## Regression tests

`tests/databaseRuntime.test.ts` covers safe defaults, development opt-in, production refusal, SQL logging and invalid ports. CI also runs the full backend regression suite.

Notion: [Servidor — Auditoria viva](https://app.notion.com/p/409ec07d7c4f8158ae8cf46c4b10ac2c).
