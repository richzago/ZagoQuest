# ZagoQuest — Servidor Node.js

Servidor autoritativo Node.js/TypeScript para o MMORPG 2D ZagoQuest, com API Express, WebSocket (`ws`), PostgreSQL/TypeORM e mapas do Tiled. O cliente Unity/C# é separado. Este projeto está em desenvolvimento ativo e **não deve ser exposto à Internet** com o protocolo legado de WebSocket.

## Ambiente e dependências

- **Node.js 22** (versão usada em GitHub Actions) e npm.
- **PostgreSQL 16** no teste de integração do GitHub Actions; configurar conexão local conforme a instalação.
- Executar todos os comandos de build/startup com o terminal **na pasta `server/`**, não na raiz do Git.
- O build **compila TypeScript em `server/dist/`**, mas o runtime também exige os JSONs em `server/src/data/` e o mapa do Tiled em `assets/maps/test-map.json`, pasta irmã do `server/`. Não distribuir apenas `dist/`.
- Unity Editor necessário para testes visuais; C# não é compilado pela CI de Node.

## Instalação e testes (PowerShell)

```powershell
cd server
Copy-Item .env.example .env
# Edite o .env local; NUNCA faça commit de senhas nem de JWT_SECRET.
npm ci
npm run build
npm test
npm run bench:tick
npm run dev
```

Para testar o binário compilado, após o build, interrompa `npm run dev` e execute `npm start` (equivale a `node dist/main.js`). O banco precisa estar disponível; o servidor não deve tentar recriar tabelas em bases com dados reais. Pare com **Ctrl+C** e confira os logs de `[SHUTDOWN]`. Nunca rode duas instâncias na mesma porta.

**Aviso de banco:** o `.env.example` tem `DB_SYNCHRONIZE=false`. É a configuração recomendada. Se o banco `zagoquest_test` estiver vazio, ele não ganhará schema automaticamente: use um backup restaurável de uma base de teste já preparada ou um processo de migração revisado. Não ative `synchronize=true` num banco com saves importantes. Há agora uma migration inicial versionada **somente para banco novo e vazio**, executada via comando protegido `npm run db:init:test` no `zagoquest_test`. Veja `docs/PHASE8_POSTGRES_WINDOWS_QA.md`. Migrations de atualização de dados antigos continuam pendentes.

## Variáveis importantes

| Nome | Regra |
| --- | --- |
| `NODE_ENV` | `development`, `test` ou `production` |
| `API_PORT` | Porta HTTP e WebSocket (padrão 3000). 0 permite porta aleatória em testes |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Conexão com PostgreSQL; para teste local preferir `DB_NAME=zagoquest_test` |
| `DB_SYNCHRONIZE` | `false` por padrão; `true` proibido em produção; usar apenas base descartável |
| `DB_LOGGING` | Padrão `false`; `true` proibido em produção |
| `JWT_SECRET` | Necessário para REST JWT; produção exige mínimo 32 caracteres e não aceita placeholders |
| `CORS_ALLOWED_ORIGINS` | Em produção, lista de origens HTTPS confiáveis separadas por vírgula; sem configuração, navegadores de outras origens não recebem permissão CORS. No desenvolvimento, origens são liberadas por padrão, salvo allowlist explícita |
| `LOG_LEVEL` | `DEBUG`, `INFO`, `WARN`, `ERROR`; WARN/ERROR importantes continuam emitidos |
| `GAME_METRICS_ENABLED` | `true` para resumos a cada 240 ticks (p50/p95/p99, CPU, RSS, players, sockets, filas) |
| `CHARACTER_NAME` | Personagem de bootstrap do protótipo legado (nome de teste) |

**Segredos:** nunca colocar JWT/senha no nome de branch, logs, issues ou prints. O logger tem mascaramento defensivo, mas ele não substitui a proibição de registrar dados sensíveis nos handlers. Arquivos em `server/logs/` possuem rotação por dia, **sem retenção/tamanho máximo** ainda: observar consumo de disco.

## Proteções da API pública (Fase 7)

- `POST /api/sessions`: até **20 requisições por 5 minutos por IP**, respondendo HTTP 429 e `Retry-After` quando excedido.
- `POST /api/accounts`: até **5 requisições por hora por IP**, com HTTP 429 em excesso.
- Esses limites são **por processo e em memória**, não protegem várias instâncias distribuídas e não substituem proteção no proxy/firewall/WAF. Se hospedar atrás de um reverse proxy, configurar rate limit real no ingress e identificar corretamente o IP **sem confiar cegamente em X-Forwarded-For**. O Express mantém `trust proxy` desligado por padrão.
- CORS é somente uma restrição de **navegador**: clientes Unity nativos e scripts sem cabeçalho `Origin` continuam aceitos, respeitando JWT/permissões. Um cliente não-browser pode chamar a API independentemente do CORS. `CORS_ALLOWED_ORIGINS` suporta lista exata, como `https://play.exemplo.com,https://painel.exemplo.com`; origens externas não são liberadas em produção.
- O login REST valida entrada via Zod, retorna 400 (inválida), 401 (credenciais genéricas), 500 (erro interno sanitizado) ou 429 (limite); sucesso mantém `{ token, accountId }` com JWT HS256/24h. Detalhes em `docs/PHASE7_REST_API_AUDIT.md`.

## CI e performance

O workflow `.github/workflows/server-check.yml` executa build/testes no Linux e Windows e um job isolado com PostgreSQL 16 efêmero, `DB_NAME=zagoquest_ci`. O job PG valida regressões de economia e (PR da Fase 6) faz smoke `node dist/main.js` carregando o Tiled, HTTP e SIGTERM com salvamento final.

```powershell
npm run build
npm test
npm run bench:tick
```

O benchmark usa `World`/`Monster`/`MonsterAI` reais, mas **sem Unity, clientes reais ou PostgreSQL**. Cenários de 0, 25, 100 e 250 monstros são sintéticos. Não comparar números absolutos da CI com teu computador nem supor que 250 monstros cabem numa hunt multiplayer sem medições reais.

**Não rodar `npm run smoke:dist` localmente**: ele é guardado para rodar só em `zagoquest_ci` efêmero com `RUN_PG_TESTS=true` na CI. Para validação local, prefira `npm start` e Ctrl+C num banco de teste.

## Estado das fases

- **Fase 4:** autosave, restauração de posição e correção de gold integrados à `dev`. Migrations TypeORM e validação de JSONB histórico ainda pendentes.
- **Fase 5:** a autenticação WS por JWT e escolha do personagem foi implementada no [PR #61](https://github.com/richzago/ZagoQuest/pull/61). **Integração antecipada autorizada sem Play Mode local:** ainda exigem validação dois clientes Unity + PostgreSQL de teste, reconexão, viewport e timers. Habilite `WS_AUTH_REQUIRED=true` em desenvolvimento e `requireAuthenticatedSession=true` no Unity. Em produção a autenticação é obrigatória; não exponha modo legado.
- **Fase 6:** logs/configuração/shutdown instrumentados ([PR #62](https://github.com/richzago/ZagoQuest/pull/62)); medição de tick e benchmark ([PR #63](https://github.com/richzago/ZagoQuest/pull/63)); smoke dist ([PR #64](https://github.com/richzago/ZagoQuest/pull/64), sujeito à CI).
- **Fase 7 (código auditado e validado automaticamente; QA 7.2 pendente):** 12 endpoints, login/JWT, CORS/limites, cadastro/Character/Guild com conflitos e erros seguros, URLs de imagem/DTO, limites de JSON e senha, PRs #67–#74. Contratos em `docs/API_REST_CONTRACT_V1.md`, auditoria em `docs/PHASE7_REST_API_AUDIT.md`. Testes HTTP/PG16 da CI não substituem duas contas no Unity + PostgreSQL local.
- **Fase 8 (automação/documentação finalizadas; QA local pendente):** matriz de validação final em `docs/PHASE8_FINAL_VALIDATION.md`: build/testes, duas contas no REST/Unity/WS, gameplay, save/restart, carga, shutdown e bloqueadores. Ainda NÃO homologada; migrations TypeORM versionadas e testes locais permanecem pendentes.

## Diagnóstico de problemas

- **`EADDRINUSE`:** porta 3000 ocupada; parar outro servidor, não usar `kill` em processos sem identificar.
- **`ECONNREFUSED` ao PostgreSQL:** verificar serviço/host/porta, nome da base e permissões no `.env` (não copiar senha nos relatórios).
- **Asset ausente ou mapa procedural:** confirmar que o terminal está na pasta `server/` e que `server/src/data` e `../assets/maps/test-map.json` existem. O bootstrap pode cair para mapa procedural; para validar dados reais isso é erro de ambiente.
- **Sinal de desligamento:** aguardar `[SHUTDOWN] Finalizado`. Se uma etapa demorar mais de 15 s, o watchdog avisa mas **não interrompe** a operação de salvamento. Forçar encerramento poderá perder dados.
- **Unity desconectado:** checar protocolo e flag de autenticação correspondentes à mesma branch. Não misturar um Unity da PR #61 com a `dev` sem o servidor do mesmo PR.

Mais detalhes: `docs/PHASE6_INFRASTRUCTURE_AUDIT.md`, `docs/PHASE6_PERFORMANCE_BENCHMARK.md`, `docs/PHASE8_POSTGRES_WINDOWS_QA.md` e `docs/PHASE8_TECHNICAL_FINAL_REPORT.md`.
