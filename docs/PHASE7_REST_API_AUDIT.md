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


### PR #71 — Guild protegida: domínio, autorização e transação HTTP/PG

- Problema: handlers protegidos de Guild convertiam qualquer erro em HTTP 400 com `error.message`, inclusive exceções PostgreSQL (por exemplo, trigger recusando inserir `guild_members`). Isso pode expor SQL interno e confundir falha do servidor com erro de usuário.
- Solução: `GuildRuleError` tipa falhas esperadas de domínio de `createGuild` e edição de metadados; controllers respondem 400 apenas para essas falhas. Erros inesperados retornam 500 com texto genérico. Verificações do JWT e propriedade continuam respondendo 401/403.
- Teste real HTTP/PG16 descartável: dois titulares de `Account`, cada qual com um `Character` próprio; tentativa de criar por personagem alheio recebe 403; proprietário cria por 20.000 gold; edição alheia recebe 403; atualização do líder recebe 200. Trigger SQL simula erro após a cobrança: resposta 500 sem mensagem SQL, gold preservado e nenhuma guilda criada. Duas chamadas REST concorrentes para o mesmo personagem: apenas uma guilda criada e apenas uma taxa debitada.
- Teste unitário adicional valida mapeamento 400/500 nos quatro endpoints protegidos.
- Cuidado: os logs de Guild ainda são escritos em operação separada após atualização de metadados; essa atomicidade é item de robustez futuro. Não confundir esta validação PG16 efêmera com homologação do PostgreSQL local e Unity.


## Rodada de encerramento — Character REST (PR #72, 31/10/2026)

- **Bug confirmado:** `CharacterController.create/list` respondia 400 com `error.message` para toda exceção, incluindo erro de conexão/consulta SQL. Isso vazava informação de infraestrutura e classificava falha do servidor como erro do usuário.
- **Bug sob concorrência:** a pré-consulta `findOneBy({name})` não impedia duas contas de tentar inserir o mesmo nome simultaneamente; conflito unique poderia escapar com mensagem SQL. PostgreSQL mantém a constraint única como garantia final.
- **Correções:** erros de input tipados 400; conflito de personagem 409; conta assinada que não existe mais 401 genérico; falha SQL/outros erros 500 sem detalhes internos. Consulta de Character sempre por ID da conta do JWT; acesso cruzado segue 403.
- **Validação:** `world` obrigatório não vazio (ou padrão `main`) limitado a 32 caracteres alfanuméricos/underscore/hífen. Não altera nomes de personagens ou gameplay.
- **Testes:** contrato unitário 400/401/403/409/500 e HTTP com PG16 descartável: duas contas e criação concorrente de mesmo nome, uma 201 e uma 409, sem alterar conta alheia. CI/merge e smoke Unity ainda precisam de comprovação.


## Rodada de encerramento — Guild URL e DTO público (PR #73, 31/10/2026)

- **Bug confirmado:** PUT de imagem de guilda aceitava qualquer texto não vazio e persistia protocolos perigosos como `javascript:`; scripts/HTML poderiam consumir esse valor posteriormente.
- **Correção:** `guildImageUrlSchema` permite somente URL HTTPS (máximo 2048 caracteres, sem credenciais). `http://localhost` ou `127.0.0.1` é permitido apenas em `NODE_ENV=development` para QA local.
- **Bug de contrato:** `GET /api/guilds/:guildName` espalhava a entidade TypeORM inteira, removendo apenas `logs`. Uma coluna futura seria exposta automaticamente. Agora retorna DTO explícito de metadados públicos.
- **Testes:** Zod de URL, rota de detalhe com campos internos simulados e HTTP+PG16 com edição de imagem segura vs insegura. URLs já persistidas anteriormente **não** são reescritas; o cliente web deve tratar URLs como dados não confiáveis e aplicar CSP apropriada.
- CI e homologação local ainda precisam de validação.


## Rodada de encerramento — corpo HTTP e senhas (PR #74, 31/10/2026)

- **Bug real de segurança de cadastro:** `createAccountSchema` aceitava senha de comprimento ilimitado; bcrypt usa no máximo 72 **bytes UTF-8**, então senhas distintas com mesmo prefixo poderiam produzir o mesmo hash. Agora novas senhas exigem 8 ou mais caracteres e máximo 72 bytes UTF-8. Login de contas históricas continua com o limite anterior de 1024 caracteres, evitando bloqueio automático antes de migração de credenciais.
- **Limites de campos:** email até 254, nome completo até 120, endereço até 500 e data obrigatoriamente `YYYY-MM-DD`, com idade mínima de 16 anos. Não normalizamos email de contas legadas sem avaliar colisões/case-insensitive e migração.
- **HTTP:** `express.json({limit:'16kb'})`; JSON malformado retorna 400 e payload acima do limite 413, ambos com erros genéricos. Erros não tratados do Express retornam 500 sanitizado, inclusive o caso de uma futura rota falhar.
- **Teste:** validação UTF-8 na fronteira de 72 bytes (acentos), data/tamanhos e requisições HTTP reais para 400/413, sem PostgreSQL. Validação no Unity/login e migração de contas históricas permanecem pendentes.


## Encerramento da implementação da Fase 7.1 e transição para Fase 8 (31/10/2026)

- **PR #72:** Character REST erros tipados 400/401/409/500, mundo validado e race de nome no PG; merge `4b499c9f`.
- **PR #73:** URLs HTTPS de imagens de Guild, até 2048 caracteres, e DTO público explícito; merge `6457f044`.
- **PR #74:** cadastro com mínimo de 8 caracteres e até 72 bytes UTF-8 (bcrypt), campos limitados, JSON HTTP até 16 KB com erro 400/413 e fallback 500; merge `2c31063e`.
- **CI integrada no head da dev:** [Actions #41196511535](https://github.com/richzago/ZagoQuest/actions/runs/41196511535) — `398/398` Node no Windows, `398/398` Linux, `10/10` PostgreSQL16 descartável, smoke `DIST_SMOKE_OK`; commit `2c31063e5b9e87af8045320284c75293dff4ca73`. Assim, escopo automatizado da **Fase 7.1 foi implementado e aprovado**.
- **Não declarar Fase 7 completa:** a seção 7.2 requer testes do PostgreSQL local + Unity Play Mode em duas contas e reinício; nenhum resultado foi fornecido. Não existem migrations TypeORM versionadas, logo qualquer atualização de DB legado requer plano separado e backup.
- **Operação pública ≠ protótipo local:** throttling compartilhado, configurações de ingress/proxy/TLS, emails legados com diferenças de caixa, retenção de logs, banco migrado e monitoração real ainda não foram homologados. Senhas legadas longas continuam aceitas no login para evitar bloqueio sem plano de migração.
- Iniciada [Fase 8 — matriz final](https://github.com/richzago/ZagoQuest/blob/dev/docs/PHASE8_FINAL_VALIDATION.md). Este documento é o roteiro, não certificação de que a execução local aconteceu.
