# ZagoQuest — Fase 6: auditoria de infraestrutura (31/10/2026)

## Estado da etapa anterior

Fase 5 **NÃO encerrada**. PR #61 (`feat/phase5-authenticated-ws-unity-qa`) passou 359 testes Windows, 359 Linux e 5 PostgreSQL CI, mas ainda não foi validado com Unity Play Mode e dois clientes em `zagoquest_test`. PR #61 permanece Draft. As mudanças da Fase 6 nesta branch não alteram o protocolo WS/Unity.

## 6.1 — Diagnóstico por área

| Requisito | Resultado | PR/pendência |
|---|---|---|
| Logs seguros/úteis | BUG: `LoggerConfig.debug=false`, nível mínimo ou filtro de canais escondiam até alertas de WARN/ERROR; logs aceitavam tokens/senhas interpolados. | **Corrigido nesta branch:** eventos críticos sempre visíveis, redaction de Bearer/JWT/password/secret/URL PG, fallback caso escrita de arquivo falhe. Mensagens de gameplay permanecem filtráveis. |
| Startup/erros | `main.ts` já tenta fechar WS/HTTP/PG em falha. `DB_SYNCHRONIZE` já protegido em produção; produção não exigia secrets/host explícitos. | **Corrigido nesta branch:** validação antes do bootstrap; testada sem banco. Falhas de assets, DB e portas merecem testes integrados adicionais. |
| Shutdown/timeout | Ordem correta prévia: stop ticks → dreno WS → HTTP → timers → guild job → autosave → PG, idempotente; etapa travada não mostrava tempo. | **Corrigido nesta branch:** watchdog diagnóstico por etapa, SEM interromper save/commit; timer removido após etapa. **Não existe timeout coercitivo** (abandonaria save e seria arriscado). |
| Config ambientes | `.env.example` tinha `DB_SYNCHRONIZE=true`, perigoso ao copiar. | **Corrigido:** padrão falso, validação produção, LOG_LEVEL configurável. `DB_LOGGING=true` vetado em produção. |
| Build/dist/assets | `tsc` gera `server/dist` (não copia JSON). Os loaders leem JSONs em `server/src/data` e mapa em `assets/maps` (pasta irmã do server). | Exige distribuição de **código compilado + server/src/data + assets/maps** preservando layout. Não assumir que `dist/` sozinho funciona. Teste de boot completo com PostgreSQL local ainda necessário. |
| CI | Já testa Linux/Windows, e PG 16 descartável em job separado. | Suite desta branch adicionada ao `npm test`; executar CI antes de merge. Não usa banco local. |
| Desempenho | Tick sincronizado 250ms, autosave 60s, tarefas de guilda 24h; ainda sem amostra p95/p99 baseada em carga. | **Próximo PR independente**: instrumentar tempo dos ticks e benchmark headless de carga, sem alterar IA prematuramente. |
| Operação | README ainda curto; sem deploy end-to-end/backup/recovery comprovados. | Ampliar documentação de operação, porta/Node, PostgreSQL 16, limitações. |

## Contrato de configuração

- `NODE_ENV`: development (padrão), test ou production; inválidos recusados.
- `API_PORT`: 0–65535; 0 apenas para teste de porta aleatória. `DB_PORT`: 1–65535.
- `DB_SYNCHRONIZE=false` **por padrão** e recomendado em bases com dados; `true` apenas em dev local descartável ou `zagoquest_ci` efêmero, proibido em prod.
- `JWT_SECRET`: em produção mínimo 32 caracteres e não usar strings placeholder; `DB_PASSWORD`, `DB_HOST`, `DB_NAME`, `DB_USER` explícitos.
- `DB_LOGGING=true` proibido em produção (pode imprimir SQL/param). Mesmo com redaction do Logger, **não registrar tokens no controller/HTTP logs**.
- `LOG_LEVEL=INFO|DEBUG|WARN|ERROR`: WARN e ERROR de infraestrutura não podem ser silenciados por filtros de debug/canal. Rotação existente é diária, **sem limite de retenção/tamanho** (pendência operacional).
- `WS_AUTH_REQUIRED`: na dev atual o WS legado continua ativo. O handshake protegido está no PR #61, **fora da dev**. Nunca expor o modo legado à Internet.

## Comandos seguros (Windows, raiz do repo)

```powershell
git status
git fetch origin
git switch dev
git pull --ff-only origin dev
cd server
npm ci
npm run build
npm test
```

Para `npm run dev` / `npm start`, confirmar `server/.env` apontando para um PG de **teste** e executar a partir de `server/`. Não editar schemas/migrations nem trocar `DB_SYNCHRONIZE` em `zagoquest` sem backup restaurável. `npm start` é `node dist/main.js`, mas ainda exige `server/src/data` e `../assets/maps`.

## Testes desta entrega

- `phase6LoggingRuntime.test.ts`: sanitização de JWT/headers/senhas/PG URL, manutenção de WARN/ERROR com debug desligado, segredos exigidos e `synchronize`/SQL logging vetados em produção.
- `phase6ShutdownDiagnostics.test.ts`: watchdog notifica etapa WebSocket lenta, PG não fecha antes da etapa/salvamento final, timers não ficam órfãos, configuração inválida rejeitada.
- CI normal de Windows/Linux e PG CI devem permanecer verdes antes do merge.

## Checklist de saída (ainda não encerrado)

- [ ] Validar build + `npm start` com assets em Windows e PostgreSQL de teste.
- [ ] Testar erros startup: asset ausente, porta ocupada, PG indisponível.
- [ ] Testar Ctrl+C SIGTERM, dreno das filas e shutdown sob carga real (sem perder personagens).
- [ ] Medir tick p50/p95/p99, CPU/RSS/filas sob carga e registrar máquina/cenário/amostras.
- [ ] Definir estratégia de rotação/limite/retention de logs e padronização dos demais erros.
- [ ] Testar backup/restauração e finalizar documentação operacional antes de concluir a Fase 6.
