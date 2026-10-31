# ZagoQuest REST API — Contrato documentado v1 (31/10/2026)

> **Versão documental v1**, sem prefixo de versão na URL: os caminhos reais continuam em `/api/...`. Não existe endpoint `/api/v1` neste repositório. Backend de desenvolvimento; **não expor na internet** sem revisar segurança, limites, migrations e infraestrutura.

Base local padrão: `http://127.0.0.1:3000`. HTTP REST e WebSocket usam o mesmo servidor/porta.

## Autenticação

- Para rotas protegidas: `Authorization: Bearer <JWT>`. O token é gerado em `POST /api/sessions`, assinado com **HS256** e expira em **24 horas**.
- O `id` assinado no JWT é o identificador **da conta**, não do personagem. O WebSocket autenticado exige adicionalmente o `characterId` e consulta o banco para confirmar propriedade.
- Não armazenar ou logar o token em texto claro. Não enviar credenciais reais em issues/prints.
- Falta de token, token expirado, assinatura/algoritmo inválido: HTTP 401.

## Contas e sessão

| Método | Rota | Corpo obrigatório | Sucesso | Falhas relevantes |
| --- | --- | --- | --- | --- |
| POST | `/api/accounts` | `email`, `cellphone`, `fullName`, `cpf`, `birthDate`, `password`, `confirmPassword`, `address` | 201 `{id,email}` | 400 validação, 409 duplicidade (email/CPF sem distinção), 429 abuso, 500 falha interna |
| POST | `/api/sessions` | `email`, `password` | 200 `{token,accountId}` | 400 formato inválido, 401 credenciais genéricas, 429 limite, 500 falha interna |

Cadastro valida via `createAccountSchema`: CPF com dígitos válidos, telefone `+55` seguido de 10–11 dígitos, data de nascimento com idade mínima de 16 anos, senha de pelo menos 6 caracteres e confirmação idêntica. A política de 72 bytes do bcrypt e normalização de email ainda estão sob auditoria; não interpretar isso como aprovação de produção.

O login usa validação Zod: email válido até 254 caracteres, senha não vazia de até 1024 caracteres, sem campos extras.

## Personagens (JWT obrigatório)

| Método | Rota | Corpo/param | Sucesso | Falhas relevantes |
| --- | --- | --- | --- | --- |
| POST | `/api/characters` | `name`, `gender` (`M` ou `F`), `world` opcional (padrão `main`); `accountId` legado opcional mas deve ser igual ao JWT | 201 `{id,name}` | 401 sem JWT, 403 accountId alheio, 400 validação |
| GET | `/api/characters/account/:accountId` | `:accountId` da mesma conta do JWT | 200 array `[{id,name,gender,world,level}]` | 401 sem JWT, 403 conta alheia, 400 accountId ausente |

Nomes de personagem no schema: 3–20 caracteres, palavras com inicial maiúscula e demais letras minúsculas, sem números ou símbolos. A lista inclui o `id` necessário ao handshake do Unity/WS e não inclui senha, CPF, inventário, gold ou conta de terceiros.

## Guildas — quatro rotas públicas

| Método | Rota | Resultado 200 |
| --- | --- | --- |
| GET | `/api/guilds/rank/level?page=1&limit=10` | `{page,limit,total,data:[{guildName,level,exp}]}` |
| GET | `/api/guilds/rank/kills?page=1&limit=10` | `{page,limit,total,data:[{guildName,totalKills}]}` |
| GET | `/api/guilds/list?page=1&limit=100` | `{page,limit,total,data:[{name,profileImage,description}]}` |
| GET | `/api/guilds/:guildName` | Metadados `Guild` sem `logs`; 404 se ausente |

Paginação: `page` de 1 a 10.000, `limit` de 1 a 100. Valores inválidos recebem 400. Erros SQL inesperados recebem 500 genérico. O detalhe público ainda retorna campos da entidade, sem DTO explícito; estabilizar a seleção de colunas antes de API pública.

## Guildas — quatro rotas protegidas

| Método | Rota | Corpo | Sucesso |
| --- | --- | --- | --- |
| POST | `/api/guilds` | `{characterName,guildName,description}` | 201 `{id,name,description}` |
| PUT | `/api/guilds/:guildName/description` | `{characterName,description}` | 200 `{message}` |
| PUT | `/api/guilds/:guildName/profile-image` | `{characterName,imageUrl}` | 200 `{message}` |
| PUT | `/api/guilds/:guildName/cover-image` | `{characterName,imageUrl}` | 200 `{message}` |

Todos exigem JWT da conta proprietária do personagem indicado. Edições exigem que o personagem pertença à guilda indicada na URL e seja o **líder**. O serviço revalida papel antes de persistir. Criar guilda exige personagem level 100+, 20.000 gold e não pertencer a outra guilda. Cobrança + criação de guilda + líder ocorrem na mesma transação PostgreSQL com lock sobre `Character`; para Player online, a reserva de gold é conciliada com memória do jogo. HTTP 401 = não autenticado; 403 = personagem/guilda alheios; 400 = validação ou regra de guilda; 500 = erro interno sanitizado. Ainda não há schema rígido de URL de imagem; não usar dados não confiáveis diretamente em HTML.

## Limites e CORS

- Login: **20 requisições por IP a cada 5 minutos**. Cadastro: **5 por IP a cada 60 minutos**. Excesso = HTTP 429 com cabeçalho `Retry-After`. Limitação atual é por **instância em memória**, não substitui proteção distribuída de ingress.
- CORS em produção: origens de navegador devem estar em `CORS_ALLOWED_ORIGINS` (separadas por vírgula). Sem allowlist explícita em produção, nenhum `Origin` externo é autorizado. CLI e Unity nativo sem cabeçalho `Origin` não são bloqueados pelo CORS; JWT continua obrigatório.
- Páginas web não conseguem contornar CORS, mas scripts e apps nativos podem enviar HTTP diretamente. CORS **não é controle de autenticação**.

## Impacto Unity (cliente em desenvolvimento)

- O sucesso de login `POST /api/sessions` permanece `{token,accountId}`; a lista de personagens inclui UUID para `NetworkManager` autenticar o WebSocket como `{type:'authenticate',token,characterId}`.
- O protocolo de eventos WebSocket, gameplay, movimento e loot **não foi alterado** pelos PRs da Fase 7 descritos aqui.
- Atualizações de erros HTTP e 429 devem ser tratadas pela UI; não assumir que erro sempre será 400 ou 401.
- Testes reais no Unity Play Mode com duas contas + PostgreSQL `zagoquest_test` **ainda pendentes**. Não enviar prints com JWT/senhas.

## Evidência e pendências

- Testes unitários HTTP, integração HTTP + PG16 efêmero, regressões JWT/account, rollback e concorrência foram adicionados na Fase 7. Consultar `docs/PHASE7_REST_API_AUDIT.md` e os PRs #67–#71 antes de declarar homologação.
- **Ainda pendentes:** migrações TypeORM versionadas e validação de dados históricos, robustez multi-instância e proxy, schema de imagens, controle de JSON request, revisão da política de senhas e revisão de DTO público de Guild.
- A Fase 7.2 local permanece obrigatória, além dos smoke tests de Unity/PG das Fases 5 e 6.
