# Fase 7 — Auditoria da API REST (rodada 1, 31/10/2026)

> Fonte: código da branch `dev` após PR #66 (`cb10d50a`). Este registro representa **inspeção estática e testes de regressão**, não homologação do Unity ou do banco local.

## Inventário de endpoints (12)

| HTTP | Endpoint | Guarda | Contrato / serviço |
| --- | --- | --- | --- |
| POST | `/api/accounts` | Público | `AccountController.create` → `AccountService.createAccount` |
| POST | `/api/sessions` | Público | `SessionController.login` → `SessionService.login` |
| POST | `/api/characters` | JWT | `CharacterController.create` → `CharacterService.createCharacter`; dono sempre `req.user.id` |
| GET | `/api/characters/account/:accountId` | JWT | `CharacterController.list`; caminho precisa coincidir com JWT |
| GET | `/api/guilds/rank/level` | Público | Ranking nível |
| GET | `/api/guilds/rank/kills` | Público | Ranking kills |
| GET | `/api/guilds/list` | Público | Listagem paginada |
| GET | `/api/guilds/:guildName` | Público | Detalhes (logs removidos pelo controller) |
| POST | `/api/guilds` | JWT + dono de personagem | Criação com custo de gold e transação SQL |
| PUT | `/api/guilds/:guildName/description` | JWT + dono + líder no service | Edição descrição |
| PUT | `/api/guilds/:guildName/profile-image` | JWT + dono + líder no service | URL da imagem |
| PUT | `/api/guilds/:guildName/cover-image` | JWT + dono + líder no service | URL de capa |

## Rodada 1: login, identidade e erros — PR da Fase 7

- **Bug confirmado (P1)**: `AccountService.authenticate` diferencia `Conta não encontrada` de `Senha incorreta`; `SessionController` devolve detalhes ao público. Isso revela se o email existe.
- **Bug confirmado (P1)**: o controller respondia HTTP 401 para qualquer exceção, inclusive falha de banco/assinatura JWT.
- **Risco de validação (P1)**: sem schema próprio, uma requisição de login poderia passar valores vazios, objetos ou strings gigantes ao serviço.
- **Inconsistência de contrato (P1)**: REST `jwt.verify` não restringia explicitamente algoritmos, enquanto a autorização do WebSocket restringe `HS256`.
- **Correção do PR**: login valida `email` e `password` via Zod antes do serviço; credenciais erradas geram resposta genérica 401; erros inesperados geram 500 genérico; assinatura e verificação REST usam HS256 explícito. Resposta de sucesso **não muda**: `{token, accountId}`, com validade de **24h**.
- **Testes novos**: unitários do contrato e erros HTTP; teste HTTP real com PostgreSQL descartável que verifica duas contas, login correto/incorreto, conta alheia, criação/listagem de personagem, JWT expirado e algoritmo divergente. A suíte Node existente já cobre isolamento de JWT/WebSocket e criação transacional de guildas. CI Linux/Windows e job PG devem ser consultados antes de afirmar aprovação.

## Achados ainda pendentes — PRs seguintes

| Prioridade | Escopo | Evidência no código | Próximo passo |
| --- | --- | --- | --- |
| P0 pré-exposição | Rate limiting | `POST /api/accounts` e `POST /api/sessions` sem limite de tentativas | Guardas de brute-force/abuso + testes, definir confiança no proxy e múltiplas instâncias |
| P0 pré-exposição | CORS | `api/server.ts` usa `app.use(cors())` (permite qualquer origem em browser) | Definir allowlist configurável para cliente web; Unity nativo não usa CORS de browser |
| P1 | Erros de cadastro | `AccountController.create` envia `err.message` para toda exceção (incluindo SQL) | Respostas tipadas 400/409/500 sem detalhes internos |
| P1 | Paginação | `parseInt(... ) || 1/10/100` aceita negativos, decimais interpretados parcialmente, enormes e NaN silencioso | Schema e limites, status 400 para parâmetros inválidos |
| P1 | Guild images | `imageUrl` é qualquer string não vazia; `profileImage` e `coverImage` são texto | Validar URL, tamanho e protocolo antes de persistir |
| P1 | Negócio/REST | Guild cria cobrança transacional com fonte de gold online; teste PG existente chama service direto | Testes HTTP reais para criação/negação/rollback/concorrência com duas contas |
| P1 | Persistência | `Character.accountId` permite null para dados legados; schema JSONB do save precisa validação histórica | QA de migração só em cópia/PG descartável, não alterar save sem teste |
| P2 | Contratos e erros | Alguns controllers devolvem `400` para erros internos ou `500` com mensagens brutas | Padronizar erros HTTP sem quebrar cliente |
| P2 | Docs | Falta OpenAPI/versão de contratos e descrição completa de Guild | Documentar esquema de request/response e compatibilidade Unity |
| P2 | Divergência docs/runtime | `server/README.md` proíbe `DB_LOGGING=true` em produção, mas `resolveDatabaseRuntime` não faz essa proibição | Alinhar implementação e documentação em PR de configuração |

### Segurança e ambiente

A API **não está homologada para Internet**. O teste PostgreSQL do GitHub Actions usa exclusivamente `DB_NAME=zagoquest_ci` descartável e `RUN_PG_TESTS=true`; nunca execute `npm run test:pg` em `zagoquest` ou `zagoquest_test` local. O Unity continua consumindo `POST /api/sessions`, lista de personagens e autenticação WS, cuja resposta de sucesso permanece compatível nesta rodada.

### Critérios pendentes de fechamento da fase

- [ ] Revisar e corrigir rate limiting, CORS, cadastro, paginação e respostas inesperadas.
- [ ] Testar REST guildas com duas contas e transações/concorrência em PostgreSQL descartável.
- [ ] Testar pessoalmente no Windows com `zagoquest_test`, duas contas, Unity login/WS, persistência após restart e negativos HTTP.
- [ ] Consolidar documentos/contratos, testar na `dev` e reconciliar checklist Notion.

Fases 5.2 e 6.2 continuam pendentes de QA manual; entrar na Fase 7 não constitui homologação delas.


## Rodadas seguintes (31/10/2026)

### PR #68 — segurança HTTP pública (integrado na dev)

- CORS explicitamente limitado em produção; `CORS_ALLOWED_ORIGINS` aceita origens exatas. Unity nativo sem `Origin` preservado.
- `POST /api/sessions`: 20 requisições por IP a cada 5 minutos; `POST /api/accounts`: 5 requisições por IP por hora; resposta `429` com `Retry-After`.
- O mecanismo é em memória e **não substitui** proxy/WAF com proteção distribuída. A validação com usuários simultâneos/atrás de NAT continua pendente.

### PR #69 — validação da listagem pública de guildas (esta rodada)

- Remover `parseInt(query.page) || 1` e `parseInt(query.limit) || 10/100`: agora somente inteiros decimais estritamente positivos, `page` até 10.000 e `limit` até 100; `400` para campos inválidos.
- Sanitizar resposta `500` de `GET /api/guilds/rank/level`, `GET /api/guilds/rank/kills`, `GET /api/guilds/list` e `GET /api/guilds/:guildName` sem expor mensagens SQL.
- Sucesso `200 {page, limit, total, data}` preservado; detalhes `404` continuam iguais; campo de histórico `logs` segue oculto.
- Unit tests do controller e teste HTTP real com PostgreSQL efêmero cobrindo paginação válida e negativos.
- Status deste PR depende de aprovação da CI e merge; nenhuma evidência manual Unity/PostgreSQL local nesta rodada.


### PR #70 — erros seguros em POST /api/accounts (esta rodada)

- Antes, `AccountController.create` respondia sempre HTTP 400 e devolvia `err.message`, incluindo exceções de PostgreSQL. `AccountService.createAccount` fazia pré-checagem de email, mas não distinguia violação de unicidade ocorrida na corrida entre `findOne` e `save`.
- Agora: schema Zod inválido → 400 com erro de validação; email/CPF já existente → 409 com texto **genérico para ambos**; falhas internas de conexão/query → 500 genérico. `{id,email}` em 201 preservado.
- Para concorrência, violação PostgreSQL SQLSTATE 23505 no `save` é reconhecida e convertida em 409. A restrição unique do banco continua sendo autoridade; não se cria lock em memória para registrar contas.
- Testes novos: unitários do controller (201/400/409/500), HTTP real + PG16 descartável com email/CPF repetidos e duas solicitações concorrentes pelo mesmo cadastro. Cadastro usa o rate limit real do PR #68; o teste mantém 5 requisições por IP/hora.
- Ainda pendente: política de tamanho de senhas vs bcrypt (limite de 72 bytes), normalização/case-insensitive de email com migração segura, limitação de payload JSON, erros de outros controllers e homologação local.
