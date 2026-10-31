# Fase 6 — Desempenho headless, observabilidade e limites de medição

## Instrumentação sem otimização prematura

A execução normal mantém intervalo **250 ms** para `tickWorld`, autosave 60 s e guildas 24 h. Esta etapa **não altera IA, combate, visão, sincronismo nem balanceamento**.

- `GAME_METRICS_ENABLED=true` habilita registros a cada **240 ticks** (~1 minuto no ritmo nominal). A flag é opcional e desligada por padrão; não provoca acesso ao PostgreSQL nem telemetria externa.
- `TickMetrics` retém **até 512 durações recentes** (ms, monotonic `performance.now`), calcula **p50/p95/p99 nearest-rank**, média, máximo e conta ticks acima de 250 ms. Contagem de slow ticks é acumulada desde o início; percentis refletem janela recente.
- Log agregado inclui duração, carga de `world.players` / `world.monsters`, **CPU time / wall clock** normalizado para *um núcleo* (pode exceder 100% quando vários núcleos trabalham), RSS e total de comandos pendentes em filas WS, sem identificar jogador/JWT.
- O método `WebSocketServer.getNetworkLoad` é **somente leitura** e fornece contagem de sockets conectados, comandos enfileirados e maior profundidade. A chamada não envia mensagens de rede nem modifica o jogo.
- A amostragem não mede latência real do Unity, nem tráfego de retransmissão ou latência PostgreSQL; essas medições exigem instrumentação de ponta a ponta na fase de QA, com usuários simultâneos e eventos de combate/loot.

## Benchmark reproduzível

Executar, a partir de `server/`:

```powershell
npm ci
npm run build
npm test
npm run bench:tick
```

Script `server/scripts/benchTick.ts`: usa `World`, `Player`, `Monster`, `MonsterAI` e `tickWorld` reais; executa quatro cenários (0, 25, 100 e 250 monstros, 1 jogador, 400 ticks medidos após 30 de aquecimento), sem sockets nem PostgreSQL. Resultados em JSON por cenário: p50/p95/p99, slow ticks, CPU time, RSS, heap e versão Node/plataforma. O GitHub Actions roda em Ubuntu sem limite de regressão automático porque runners possuem hardware e carga variáveis; **não interpretar comparações de máquinas distintas como melhora/piora**.

## Critérios para comparar

- Manter mesmos mapa, JSON de monstro, número de ticks, versões Node e hardware.
- Anotar CPU/modelo de processador, processos concorrentes, OS, timestamp, build/commit e quantidade de monstros/clientes.
- Repetir cada cenário ao menos 3 vezes e comparar distribuição, não um único número.
- Em teste multiplayer real, coletar p95/p99 da latência de comandos, fila, tamanho de mensagens, número de jogadores/monstros e impacto do autosave no PostgreSQL.
- Estabelecer meta de latência e orçamento de tick antes de otimizar; o valor de 250 ms é o intervalo do scheduler, **não** uma garantia de desempenho.

## Limites e pendências

- Nenhum profiling de Unity foi realizado aqui; benchmark headless **não valida** duas contas, viewport ou isolamento WS no PR #61.
- O resultado CI depende do runner; consumo de CPU/RSS é da **máquina de CI, não do PC local**.
- Amostragem usa percentis sobre os últimos 512 ticks, reportados periodicamente, sem coleta remota. Para alertas sustentados e histórico longo, evolução posterior.
- Fluxo de shutdown e segurança da configuração foi revisado no [PR #62](https://github.com/richzago/ZagoQuest/pull/62).
- Para encerrar Fase 6 ainda faltam: `npm start`/assets com PG local, Ctrl+C e falhas de boot, monitoramento em carga real, política de retenção de logs, documentação operacional consolidada.
