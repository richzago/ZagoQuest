# ZagoQuest — Servidor (Node.js + TypeScript)

Backend de um MMORPG 2D inspirado em Tibia. A API REST usa Express, TypeORM e PostgreSQL; o mundo e o combate são autoritativos no servidor; a comunicação em tempo real usa WebSocket (`ws`) com um cliente Unity/C# em desenvolvimento.

> **Estado:** protótipo de desenvolvimento, **não pronto para servidores públicos**. A branch principal pode não conter os PRs de estabilização: as melhorias estão empilhadas em PRs **draft** e ainda precisam de merge, validação local e smoke tests Unity. Consulte a [auditoria no Notion](https://app.notion.com/p/409ec07d7c4f8158ae8cf46c4b10ac2c).

## Tecnologias

- Node.js 22, TypeScript, Express, WebSocket (`ws`)
- PostgreSQL, TypeORM, JWT, bcrypt, Zod
- Tiled Map Editor (mapas JSON), cliente Unity/C# (repositório `Client/`)

## Organização

| Pasta | Responsabilidade |
| --- | --- |
| `src/api/` | Rotas REST, controllers, serviços, autenticação e persistência TypeORM |
| `src/data/` | Registries e configurações JSON de itens, monstros, NPCs e skills |
| `src/game/ai/` | Comportamentos de monstros e NPCs |
| `src/game/combat/` | Combate, ataques, cooldowns e condições |
| `src/game/core/` | Game loop, eventos, lifecycle e shutdown |
| `src/game/entities/` | Player, Monster, Npc e demais entidades |
| `src/game/initialization/` e `src/game/loaders/` | Construção do World e leitura de Tiled/JSON/banco |
| `src/game/systems/` | Experiência, economia, morte, loot e outros sistemas |
| `src/game/world/` | Tiles, ocupação, entidades e regras do mundo |
| `src/network/` | Servidor WS, validação, handlers, senders, broadcasts |
| `src/shared/` | Interfaces, enums e schemas |
| `tests/` | Testes unitários, de contratos e integrações WS |
| `../Client/` | Projeto Unity, C# e handlers de rede |

O fluxo principal é `main.ts → registries → API/DB → WorldFactory → WebSocket → HTTP listen → game loop`. Durante o shutdown, o servidor interrompe novos comandos, aguarda handlers, salva e fecha recursos.

## Desenvolvimento local

Instale Node.js 22 e PostgreSQL. No Windows 11 (PowerShell), a partir da pasta `server/`:

```powershell
Copy-Item .env.example .env
npm ci
npm run build
npm test
npm run dev
```

Configure o `.env` com `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `API_PORT` e opcionalmente `CHARACTER_NAME`.

**Atenção ao schema:** nas branches de refatoração, `DB_SYNCHRONIZE` é desligado por padrão e só funciona explicitamente com ambos `NODE_ENV=development` e `DB_SYNCHRONIZE=true`. Nunca use essa opção em produção. Consulte [DATABASE_RUNTIME.md](../docs/DATABASE_RUNTIME.md); migrations continuam pendentes.

O carregamento dos assets ainda usa caminhos relativos ao diretório de trabalho; execute no diretório `server/` durante o desenvolvimento. Empacotamento sem `src/data` requer trabalho adicional.

## API e WebSocket

A API normalmente usa `http://localhost:3000/api` (conforme `API_PORT`).

| Método | Rota | Autenticação |
| --- | --- | --- |
| POST | `/accounts` | Pública |
| POST | `/sessions` | Pública: emite JWT |
| POST | `/characters` | JWT: cria personagem na própria conta |
| GET | `/characters/account/:accountId` | JWT: apenas a própria conta |
| GET | `/guilds/rank/level`, `/guilds/rank/kills`, `/guilds/list` | Pública |
| GET | `/guilds/:guildName` | Pública |
| POST | `/guilds` | JWT e personagem pertencente à conta |
| PUT | `/guilds/:guildName/description` | JWT, personagem próprio e cargo autorizado |
| PUT | `/guilds/:guildName/profile-image`, `/guilds/:guildName/cover-image` | JWT, personagem próprio e cargo autorizado |

O WebSocket compartilha o HTTP e recebe comandos do Unity validados no servidor. **Limitação crítica:** a sessão WS ainda usa o personagem inicial do mundo (`world.players[0]`) e não autentica conta/characterId. O servidor bloqueia duas conexões simultâneas para o mesmo player, mas isso **não é autenticação**. Use apenas ambiente local até concluir login e sessões multiplayer.

## Sistemas implementados no protótipo

World com tiles/colisão e spawns do Tiled, monstros e NPCs, IA com aggro/perseguição/fuga, combate e condições, XP/skills, loot/cadáveres, inventário/equipamentos, banco/loja, chat, registries data-driven, API, persistência PostgreSQL e canais de logs.

O cliente Unity existe, mas a integração completa e o fluxo de sessão/autenticação ainda necessitam validação. Algumas funcionalidades são parciais e não devem ser anunciadas como prontas para multiplayer.

## Testes e documentação

```bash
npm ci
npm run build
npm test
```

CI em GitHub Actions executa build e a suíte de regressão. Testes Node simulados **não substituem** PostgreSQL real nem Play Mode/Build do Unity.

Documentos por tema em `../docs/`: [API_AUTHORIZATION.md](../docs/API_AUTHORIZATION.md), [GUILD_CREATION_TRANSACTION.md](../docs/GUILD_CREATION_TRANSACTION.md), [CONDITION_DAMAGE.md](../docs/CONDITION_DAMAGE.md), [WS_DISCONNECT_DRAIN.md](../docs/WS_DISCONNECT_DRAIN.md), [WORLD_MAP_LIFECYCLE.md](../docs/WORLD_MAP_LIFECYCLE.md), [NPC_TILED_CONFIGURATION.md](../docs/NPC_TILED_CONFIGURATION.md) e [WORLD_SNAPSHOT.md](../docs/WORLD_SNAPSHOT.md).

## Pendências para produção

1. Autenticar sessão WebSocket por JWT e **characterId de propriedade da conta**, com reconexão segura e contrato Unity.
2. Resolver a fonte de verdade entre personagem em memória e gravações REST/PG; impedir autosave de sobrescrever operações econômicas.
3. Criar migrations TypeORM versionadas; testar criação/migração/rollback em PostgreSQL real.
4. Persistir todos os jogadores ativos com consistência, não somente o personagem inicial.
5. Validar JSONs de dados e Tiled, caminhos dos assets, timeouts e recuperação de falhas.
6. Passar smoke tests Unity, integração REST/WS/PG e testes de carga antes de abrir o servidor.

Checklist executável: [BACKEND_VALIDATION_CHECKLIST.md](../docs/BACKEND_VALIDATION_CHECKLIST.md).

**Licença:** verificar a licença efetiva do repositório antes de redistribuir; não inferir a partir do README antigo.
