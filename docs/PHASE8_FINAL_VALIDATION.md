# Fase 8 — Validação geral e encerramento da refatoração do ZagoQuest

**Início:** 31/10/2026. **Estado:** EM VALIDAÇÃO; não homologado, não pronto para produção.
A Fase 8 não adiciona sistemas de gameplay: verifica a integração entre Data, World, Game, Persistência, Network, API e infraestrutura. Novos bugs comprovados serão corrigidos em PRs pequenos na área responsável.

## 1. Baseline verificável

| Elemento | Evidência |
| --- | --- |
| Branch | `dev` (nunca `main` sem autorização) |
| Última rodada de código API | PRs [#67](https://github.com/richzago/ZagoQuest/pull/67)–[#74](https://github.com/richzago/ZagoQuest/pull/74) |
| SHA de entrada na Fase 8 | `2c31063e5b9e87af8045320284c75293dff4ca73` |
| CI da dev | [Actions #41196511535](https://github.com/richzago/ZagoQuest/actions/runs/41196511535) |
| Node Windows | 398/398 testes, build OK |
| Node Linux | 398/398 testes, build OK, benchmark de tick executado |
| PostgreSQL 16 descartável | 10/10 testes, inclusive REST, rollback, concorrência e autenticação WebSocket |
| Smoke `dist` | Inicia Node compilado, carrega Tiled/JSON, consulta PG, verifica HTTP 401 e SIGTERM com save final: `DIST_SMOKE_OK` |
| Unity | **Sem execução automática**. Dois clientes e Play Mode no Windows ainda não foram homologados. |

### Validação automatizada de fechamento do código (PR #76)

- [x] [CI da dev #41199146841](https://github.com/richzago/ZagoQuest/actions/runs/41199146841) aprovada no merge `568a50f32b49939d25e555dc1044947ac794148e`: **400/400 Windows**, **400/400 Linux**, **10/10 PG16** e `DIST_SMOKE_OK`.
- [x] PostgreSQL CI criado a partir da migration `InitialSchema1793400000000` em base nova, com `DB_SYNCHRONIZE=false`; comando recusa banco não vazio, host remoto e ausência de opt-in.
- [x] Relatório final e guia Windows em `docs/PHASE8_TECHNICAL_FINAL_REPORT.md` e `docs/PHASE8_POSTGRES_WINDOWS_QA.md`.
- [ ] Assinatura local 5.2, 6.2, 7.2 e 8.2 — somente o usuário pode validá-la. Migrations de **atualização para saves históricos** e implantação pública são roadmap operacional separado.

**Os números acima provam apenas o SHA indicado.** Toda integração subsequente exige checar CI da própria `dev` novamente. O resultado dos testes Node não valida Unity ou um PostgreSQL local com dados legados.

## 2. Estado de encerramento da Fase 7

- **7.1 — Implementação/auditoria automatizada:** inventário dos 12 endpoints, autenticação JWT, autorização account/character/guild, entrada Zod, códigos HTTP, CORS, rate limit por processo, confirmação SQL de concorrência, rollback, guild DTO/URL, documentação: **implementado e coberto pela CI** nos PRs #67–#74.
- **7.2 — Homologação local:** **PENDENTE**, necessita duas contas reais de teste, JWT, Character, Guild, rollback seguro, reinício e Unity. Portanto, não declarar a *Fase 7 completa* sem essa evidência.
- **Escopo explicitamente não homologado para produção:** rate limiting compartilhado atrás de proxy, TLS, monitoramento e mitigação de abuso distribuído, conta legada com email case-insensitive, política para credenciais bcrypt antigas, migrations versionadas e banco histórico. Estes itens seguem como bloqueadores de lançamento, não como features novas de gameplay.

## 3. Portões de entrada da Fase 8

1. `git status` limpo (ou alterações locais guardadas), `dev` atualizada, versão Node 22 (a usada na CI).
2. PostgreSQL **somente de teste**, recomendado `DB_NAME=zagoquest_test`. Dados do jogo real/produção NÃO podem ser usados em teste de falha, rollback ou criação de guilda.
3. Backup restaurável e anotação privada das configurações. NÃO compartilhar `.env`, senha, JWT ou CPF real.
4. `DB_SYNCHRONIZE=false` no banco que contenha qualquer dado a preservar. **Não executar `npm run test:pg` nem `npm run smoke:dist` localmente**: estes scripts são exclusivos de `zagoquest_ci` efêmero no GitHub Actions.
5. `WS_AUTH_REQUIRED=true` e Unity `requireAuthenticatedSession=true`, com `SessionLoginDebugUI` configurada para os testes da Fase 5/7.
6. Banco e esquema devem estar PREPARADOS. O projeto agora possui a migration inicial **somente para database NOVA e vazia** e o comando protegido `npm run db:init:test`. Aplique somente seguindo `docs/PHASE8_POSTGRES_WINDOWS_QA.md`. Migrar banco existente/histórico requer um plano diferente e backup restaurável. Nunca ativar synchronize sobre dados importantes.

### Comandos Windows — somente leitura/build, sem alterar o banco

Executar na raiz do ZagoQuest:

```powershell
git status
git fetch origin
git switch dev
git pull --ff-only origin dev
git log -1 --oneline
cd server
node --version
npm ci
npm run build
npm test
```

Se o `git pull` acusar modificação local, preservar/comparar com `git diff` antes de restaurar ou descartar. Não usar `git reset --hard` sem identificar exatamente quais mudanças seriam perdidas.

Com a base de teste já preparada e o `.env` seguro, em outro momento executar:

```powershell
# Terminal na pasta server/
npm start
# Confirmar boot do mapa, PostgreSQL, REST e WS.
# Testar manualmente com Unity em outra janela.
# Encerrar com Ctrl+C, conferir [SHUTDOWN] Finalizado.
```

**Backup PostgreSQL:** usar `pg_dump` em formato custom com credenciais informadas de modo privado, por exemplo `pg_dump -h localhost -U <seu_usuario> -Fc -f zagoquest_test_backup.dump zagoquest_test`. O arquivo de backup NÃO deve ir para o Git. Confirmar que consegue restaurá-lo em base **separada e descartável** antes de qualquer teste destrutivo.

## 4. Matriz de integração de ponta a ponta

Legenda: `AUTO` = testes Node/PG efêmero passam na CI; `LOCAL PENDENTE` = depende do jogo e da base no teu Windows. Passou em AUTO não marca LOCAL.

| ID | Fluxo e resultado esperado | Evidência automática | Teste local |
| --- | --- | --- | --- |
| F8-01 | Boot `npm start` com assets Tiled e PostgreSQL de teste; Ctrl+C salva e encerra | Smoke dist + shutdown CI | LOCAL PENDENTE |
| F8-02 | Conta A/B: cadastro e login retornam `{id,email}` / `{token,accountId}` sem vazamento | REST HTTP+PG, 401/409/429 | LOCAL PENDENTE |
| F8-03 | JWT inválido/expirado e conta B no Character A recebem 401/403; não expõem dados | REST/PG16 + unit | LOCAL PENDENTE |
| F8-04 | Criar/listar personagem com UUID correto; `accountId` de outra conta recusado | REST/PG16 + unique race | LOCAL PENDENTE |
| F8-05 | Dois Unity Clients com contas/personagens diferentes, sem ghost, sessão dupla do mesmo UUID rejeitada | WS/PG16, Node | LOCAL PENDENTE |
| F8-06 | Snapshot/viewport e movimentação não vazam outro jogador; colisão, velocidade e teleporte recusado | Network Node + contratos C# estáticos | LOCAL PENDENTE |
| F8-07 | Combate, HP, morte, XP por dano compartilhado, loot/corpses sem duplicação | Game/Network Node | LOCAL PENDENTE |
| F8-08 | Inventário, equipamentos, NPC banker/merchant, gold online/DB coerentes | Economy/PG16 | LOCAL PENDENTE |
| F8-09 | Guild: apenas personagem dono/nível/gold suficiente cria; líder edita; outra conta recebe 403 | REST/PG16 + rollback/concorrência | LOCAL PENDENTE |
| F8-10 | Pesca, cooldown, cancelamento ao mover/morrer/desconectar, timers sem loot fantasma | Fishing Node | LOCAL PENDENTE (sem UI se necessário) |
| F8-11 | Respawn no PlayerSpawn Tiled, save UUID, posição, gold/XP/inventory persistem no restart | World/PG16 + contracts | LOCAL PENDENTE |
| F8-12 | Disconnect/reconnect JWT válido, expiração, filas e último save; cliente sem token não controla jogador | WS Auth/PG16 Node | LOCAL PENDENTE |
| F8-13 | Falha de PostgreSQL, porta ocupada e asset ausente causam erro controlado e cleanup; somente em ambiente isolado | Lifecycle/dist smoke parcial | LOCAL PENDENTE |
| F8-14 | Logs sem segredos, filas de WS sob carga, métricas de tick p50/p95/p99 e consumo de RAM | CI headless 0/25/100/250 monstros | LOCAL PENDENTE (carga real) |
| F8-15 | Documentação bate com o build, contratos Unity e dados reais; divergências registradas | README + docs + CI | LOCAL PENDENTE |

### Como registrar cada caso

```text
CASO: F8-XX
SHA DEV:
AMBIENTE: Windows / Unity versão / PostgreSQL zagoquest_test
CONTA/PERSONAGEM: A / B (sem credenciais ou dados privados)
AÇÃO:
ESPERADO:
OBSERVADO:
RESULTADO: PASSOU / FALHOU / NÃO HÁ UI / BLOQUEADO
LOG: somente trechos sem segredo
```

## 5. Bloqueadores e riscos conhecidos — não esconder

| Prioridade | Risco | Próximo passo e regra de segurança |
| --- | --- | --- |
| P0 homologação dados | **Migration baseline apenas para database NOVA de teste; dados existentes não migrados** | CI prova o schema no PostgreSQL 16 descartável com `DB_SYNCHRONIZE=false`. Inventariar dados/JSONB históricos e testar upgrade separado antes de bancos com saves. |
| P1 dados históricos | `Character.accountId` nullable/legado, JSONB inventory/equipment/skills e XP antigos | Regras de associação, validação/reparo de saves em cópia antes de migrar. |
| P1 QA E2E | Ainda não houve confirmação de Play Mode autenticado de dois clientes Unity | Rodar F8-05..F8-12 com duas contas/UUIDs e registrar logs. |
| P1 robustez | Startup/timeout/shutdown local e cenários de carga não reproduzidos com usuários reais | Executar F8-01/F8-13/F8-14 em ambiente isolado, medir erros e prioridades. |
| P1 segurança operacional | Rate limiting da API é por processo, e `trust proxy` não está configurado para implantação; email legado com variantes maiúsculas/minúsculas exige avaliação | Antes de Internet, definir proxy confiável, TLS, throttling distribuído, migração de email e monitoramento. Não afirmar pronto para produção. |
| P2 UX/escopo | Pesca e outras ações podem não ter UI completa; widgets de loot ainda provisórios | Marcar `NÃO HÁ UI`, separar desenvolvimento do cliente da integridade do servidor. |

## 6. Critério de saída (Fase 8)

- [x] Baseline automatizado no SHA inicial da Fase 8 com Windows/Linux, PG efêmero e smoke dist aprovados.
- [ ] Todos os casos locais aplicáveis da matriz executados, com evidências do usuário e sem P0/P1 reproduzido.
- [x] Estratégia segura de inicialização para **nova base vazia** com migration versionada, guarda por DB_NAME/host/opt-in e CI PostgreSQL com synchronize OFF. A migração de **banco já populado** e backup/restauração local ainda dependem de validação manual; não incluídos na baseline.
- [ ] Fases 5.2, 6.2 e 7.2 reconciliadas com resultados reais no Notion.
- [x] Testes de regressão final do **código** na `dev` após PR #76 no SHA `568a50f3` (Actions #41199146841). PRs posteriores apenas de documentação exigem CI própria; bugs detectados no teste local reabrem validação.
- [x] Relatório técnico de encerramento do escopo automatizado em `docs/PHASE8_TECHNICAL_FINAL_REPORT.md`; homologação Unity, PG local e migração de dados legados continuam pendentes.
- [x] Decisão de produção registrada separadamente: **NÃO PRONTO**. Requer upgrade de banco legado, TLS/proxy/rate limit distribuído, backups/restauração, métricas e carga real. Não impede encerrar o trabalho automatizado do protótipo.

**Próxima ação:** seguir `docs/PHASE8_POSTGRES_WINDOWS_QA.md` para criar o banco de teste via pgAdmin/psql, aplicar a migration inicial sem synchronize e executar F8-01..04 (REST) e F8-05..12 (Unity). Os testes manuais continuam sem evidências de execução até o usuário realizá-los.

## 7. Registro de testes locais e passagem de bastão — 31/10/2026

**Atualização após resposta do desenvolvedor:** foi confirmado que a sequência de testes locais com **PostgreSQL + API REST** realizada até **criação da guilda**, após correção de formatação PowerShell do comando, **funcionou**. Registro baseado no relato do desenvolvedor; não recebemos logs individualizados dos resultados, nem comprovação de cada caso negativo/rollback.

| Caso | Estado local após relato | Próxima evidência necessária |
| --- | --- | --- |
| F8-01 | **PARCIAL** — API/PG iniciaram para realizar operações REST | Encerramento Ctrl+C e restart sem erro |
| F8-02 | **PASSOU (relatado)** — cadastro e login na sequência local | Se necessário, anotar status sem expor JWT |
| F8-03 | **NÃO DETALHADO** — não houve confirmação isolada de todos os casos 401/403/expiração | Negativos HTTP, identidade cruzada |
| F8-04 | **PASSOU (relatado)** — personagens criados na bateria local | Comparar identidades e ausência de dados cruzados |
| F8-05–F8-08 | **PENDENTE** — Unity, movimento, combate, NPC/economia no cliente | Testes com duas sessões Unity |
| F8-09 | **PARCIAL (relatado)** — criação de guilda pela API funcionou após corrigir script | Confirmar edição indevida 403, gold 30.000→10.000 em consulta e restart |
| F8-10–F8-15 | **PENDENTE / NÃO DETALHADO** | Pesca/SEM UI, persistência, falhas controladas, desempenho, compatibilidade |

**Decisão de encerramento:**
- [x] Encerrada a **implementação/validação automatizada** do backend protótipo na branch `dev` (CI Windows/Linux/PostgreSQL).
- [x] Registrada **aprovação relatada** do recorte REST/PG local, sem generalizar para todos os testes 7.2/8.2.
- [ ] **Ainda não assinar Fase 8 completa como homologada:** faltam testes Unity Play Mode, dois clientes, shutdown/restart/estado persistido, casos negativos específicos e backup restaurável conforme matriz.
- [x] Criado o roteiro de passagem para auditoria do cliente: [`docs/CLIENT_AUDIT_ROADMAP.md`](CLIENT_AUDIT_ROADMAP.md) e [Notion — Auditoria viva do cliente Unity](https://app.notion.com/p/40aec07d7c4f818eac62d7d6a2b2d933). Os itens F8 que envolvem Unity continuam rastreados **também aqui** até validação, sem marcá-los concluídos por transferência.

**Próxima ação operacional:** iniciar fase C0 de Unity; logo após, C3 de autenticação simultânea e F8-05..F8-12, corrigindo apenas regressões comprovadas. Não declarar produção pronta ou migrar dados históricos nessa transição.
