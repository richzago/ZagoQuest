# ZagoQuest — Etapa 1.4: tarefas agendadas

**Branch:** `fix/backend-scheduled-tasks` (baseada em `fix/backend-monster-spawns`).  
**Arquivos principais:** `server/src/game/core/scheduledTasks.ts`, `shutdownHandler.ts`, `gameStarter.ts`.  
**Testes:** `server/tests/scheduledTasks.test.ts`.

## 1. Diagnóstico (bugs reais)

| Antes | Risco | Depois |
|---|---|---|
| `24 * 60 * 60 * 10` | Guildas processadas a cada **14min24s**, não a cada 24h | `24 * 60 * 60 * 1000` = **86.400.000 ms** |
| `setInterval(async () => await save())` sem guarda | Autosaves podem se sobrepor se o banco demorar mais de 60s | Uma Promise `saveInFlight` por vez |
| Sem `catch` | Erros do PostgreSQL/guildas geram rejeições não tratadas | Falhas registradas e próximas execuções preservadas |
| Sem retorno dos timers | Nenhum controle para parar/reiniciar o agendamento | `stop()` cancela os intervalos |
| Chamadas repetidas a `startScheduledTasks` | Múltiplos autosaves e limpezas da guilda | Inicialização idempotente até `stop()` |
| SIGINT salvava independentemente do timer | Gravações simultâneas e risco de estado antigo sobrescrever novo | `flushAutosave()` aguarda o save em andamento e salva novamente |
| Apenas SIGINT | SIGTERM não invoca salvamento final | SIGINT e SIGTERM executam o mesmo fluxo |

## 2. Arquitetura mínima

```text
gameStarter.ts
  ├─ startScheduledTasks(player)
  │    ├─ setInterval autosave: 60.000ms
  │    └─ setInterval guildas: 86.400.000ms
  │
  └─ setupGracefulShutdown(player, scheduledTasks)
         └─ SIGINT / SIGTERM
                ├─ controller.stop() — limpa timers
                ├─ aguarda save anterior terminar
                ├─ faz último save do personagem
                └─ encerra o processo
```

**Regra essencial:** armazenamos a Promise em `saveInFlight`. Se uma segunda execução for solicitada enquanto a primeira está pendente, ela é ignorada no timer. Um erro é registrado; um novo tick ainda pode tentar novamente.

O mesmo controle `guildInFlight` impede que duas rotinas de inatividade de guildas operem simultaneamente.

## 3. Por que não usar `setTimeout` recursivo?

Poderíamos agendar o próximo tick só após o anterior terminar. Porém isso mudaria o intervalo: um salvamento de 10s mais o intervalo de 60s viraria 70s entre inícios. Mantivemos o cronograma estável, pulando ticks sobrepostos. É simples, previsível e suficiente neste estágio.

## 4. `stop()` versus `flushAutosave()`

- `stop()`: cancela os dois intervalos. Uma consulta/gravação já em andamento pode terminar.
- `flushAutosave()`: chama `stop()`; espera eventual autosave ativo; **depois salva novamente** o estado atual. Duas chamadas simultâneas retornam a mesma Promise, sem duplicar o salvamento final.
- Se o autosave anterior falhar, `flushAutosave()` ainda tenta o salvamento final.
- Se o último salvamento falhar, o shutdown registra erro e encerra com código de falha (`1`).

A finalização de WebSocket, HTTP, timers de cadáveres e respawn é assunto da etapa geral de *lifecycle*; esta tarefa protege os timers de autosave/guildas.

## 5. Como foram feitos os testes

Em vez de esperar um minuto ou um dia, `ScheduledTaskDependencies` aceita funções de agendamento, persistência e guildas **injetadas**. No teste usamos um relógio simulado que guarda callbacks e intervalos.

Exemplo de cenário de regressão:

1. Disparar o callback de autosave (simulado).
2. Manter a primeira Promise pendente.
3. Simular mais dois ticks.
4. Confirmar que **só um save** iniciou.
5. Resolver a primeira Promise.
6. No próximo tick, confirmar que um segundo save pode começar.

Isso testa o comportamento assíncrono sem PostgreSQL, rede nem `sleep` nos testes.

## 6. Rodando no Windows (já dentro de server/)

```powershell
git fetch origin
git switch --track origin/fix/backend-scheduled-tasks
npm ci
npm run build
npm test
```

Se a branch já existir localmente, usar `git switch fix/backend-scheduled-tasks` e depois `git pull --ff-only origin fix/backend-scheduled-tasks`.

No servidor iniciado normalmente: verifique o log `[SCHEDULED] Autosave a cada 60s; guildas a cada 24h.` e a persistência após 60s. Pressione Ctrl+C para exercitar o salvamento final, **de preferência com banco de desenvolvimento**.

## 7. Pontos a rever depois

- A aplicação ainda cria apenas um jogador inicial e o scheduler é único no processo; o autosave de **todos** os jogadores conectados virá quando o sistema de sessões multiplayer estiver implementado.
- O game loop de IA tem seu próprio `setInterval`; o cancelamento completo dos loops e timers de respawn ficará para *lifecycle*.
- Tarefas de guilda já iniciadas não são canceladas por `stop()` (Node não cancela uma Promise de banco já em execução).
- Retry/backoff de consultas, transações SQL e infraestrutura de jobs distribuídos ficam para outra etapa.
- A revisão de dependências com `npm audit` foi adiada a pedido do projeto.
- Ainda precisamos smoke-test do fluxo de desligamento com banco real; testes unitários não simulam uma queda abrupta da máquina.
