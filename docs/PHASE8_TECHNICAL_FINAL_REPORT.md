# ZagoQuest — Relatório técnico final da refatoração (Fases 1–8)

**Versão:** 31/10/2026 • **Destinatário:** desenvolvedor do projeto • **Branch:** `dev`
**Escopo do encerramento:** revisão, correções e testes automatizados do **backend protótipo**. **Homologação local de Unity + PostgreSQL depende do usuário e NÃO está assinada.** O projeto não recebeu certificação para Internet/produção.

## 1. Resultado verificável e governança

- O backend Node.js/TypeScript foi estabilizado em PRs incrementais, sem reescrever a arquitetura do Network. `main` foi preservada por decisão do projeto; somente PRs aprovados são integrados à `dev`.
- A CI da `dev` antes da nova migration registrou [run #41196946890](https://github.com/richzago/ZagoQuest/actions/runs/41196946890): **398/398** testes Node em cada OS, **10/10** testes PostgreSQL16 descartável e `DIST_SMOKE_OK`.
- **Conclusão automatizada da Fase 8 (PR #76):** migration `InitialSchema1793400000000` para **base de teste vazia**, inicializador que recusa DB/host perigoso, CI com `DB_SYNCHRONIZE=false`. [Actions #41199146841](https://github.com/richzago/ZagoQuest/actions/runs/41199146841) aprovou o commit integrado `568a50f32b49939d25e555dc1044947ac794148e`: **400/400 Windows**, **400/400 Linux**, **10/10 PostgreSQL16** após a migration e `DIST_SMOKE_OK`.
- Unity/C# ainda não é compilado por essa CI. Validação de dois clientes e persistência no PostgreSQL local não foi executada pelo assistente.

## 2. Arquitetura revisada

| Bloco | Responsabilidades / contratos | Arquivos ou módulos relevantes |
| --- | --- | --- |
| Dados/asset loading | Tiled JSON, tile layers Ground/Collision/Decoration, camadas PlayerSpawn/MonsterSpawn/NPCSpawn; entidades JSON de itens, condições e monstros | `server/src/data`, `assets/maps`, `worldFactory` |
| World | Tiles, colisão, viewport, movimentos/spawn/respawn, identidade estável do Player | `game/world`, `game/initialization` |
| Game | Combat/Death, XP por dano, skills, NPC, loot, pesca, banking, economy, gold e agendamentos | `game/systems`, `game/core` |
| Persistência | PostgreSQL/TypeORM `Account`, `Character`, `Guild`, `GuildMember`; `DatabasePersistence`; locks contra conflito com autosave | `api/entities`, `api/data-source`, `game/systems/characterWriteLock.ts` |
| Transporte | Servidor HTTP Express + WebSocket `ws`; mensagens/handlers/senders, filas de broadcast, autenticação via JWT e personagem UUID no PG | `api/server.ts`, `network/websocket`, `network/auth` |
| Segurança REST | 12 rotas, JWT HS256 de 24h, account ownership, 400/401/403/409/413/429/500, CORS, limites de payload e body, respostas sanitizadas | `api/controllers`, `api/services`, `api/middlewares`, `shared/schemas` |
| Operação | Logs estruturados/redação de segredos, validação de runtime, tick percentis, métricas, shutdown com save, CI dupla plataforma/PG16 | `game/core`, `.github/workflows/server-check.yml` |
| Cliente | Unity/C#, NetworkManager autenticado e handlers, gameplay 2D e UI ainda em desenvolvimento | `Client/Assets/Scripts` e `SessionLoginDebugUI` |

## 3. Intervenções e decisões consolidadas

- **Integridade do estado do jogador:** XP acumulativo com migração de saves legados; decisões de compartilhamento XP por dano; correção de posição persistida e spawn em Tiled; proteção contra saldo negativo e cobrança duplicada; sincronização do gold em memória/SQL quando jogador online.
- **Identidade, gameplay e autoritarismo:** servidor valida movimento e ocupação de tile, estado de combate/autoattack, loot/corpses e alterações de economia. O cliente não fornece identidade confiável por nome; JWT da conta + propriedade do UUID no PostgreSQL controlam sessões.
- **Fase 5:** WebSocket autenticado, exclusividade de sessão por personagem, persistência no logout, reconexão e proteção de dados privados em testes automáticos. Unity local manual permanece pendente.
- **Fase 6:** logging/redaction, fail-closed para config perigosa, shutdown/cleanup, métricas do tick e testes de smoke do dist com PG + Tiled. Carga real com dezenas de clientes permanece pendente.
- **Fase 7 (PRs #67–#74):** Account, Session, Character e Guild revisados. Segurança de login/JWT, negativa de conta alheia, rollback da guilda sob falha de SQL, concorrência account/character/guild, paginação, HTTPS para imagens, DTO de guilda explícito, limite JSON 16KB e senha nova <=72 bytes UTF-8. Contratos de sucesso REST para Unity preservados; códigos de erro evoluíram de propósito.
- **Fase 8:** matriz F8-01..15, guia Windows para pgAdmin/psql + consultas SQL/HTTP, script guardado para iniciar **somente banco novo de teste**, baseline versionada no repositório e CI executando migration com auto-sync DESLIGADO.

## 4. Evidências e limites de teste

| Evidência | O que comprova | O que NÃO comprova |
| --- | --- | --- |
| Unit/integration Node no Windows/Linux | Regras de sistemas, contratos REST/WS simulados, cronômetros/handlers, bootstrap estático | Unity Play Mode, GPU, input real, UI |
| PG16 descartável | Account/Character/Guild, transação/concorrência SQL, login de duas contas, save/shutdown | Banco local com schema histórico, migração de contas legadas |
| `DIST_SMOKE_OK` | JS compilado, assets Tiled, HTTP 401, API/WS startup, SIGTERM/final save | Carga multiplayer real, todos os menus |
| Migração baseline | Tabelas versionadas na base vazia; comando guardado para impedir alterar DB real | Upgrade de esquema já existente, migração histórica |
| Bench tick 0/25/100/250 monstros | Métricas sintéticas comparáveis entre runs de CI semelhantes | Capacidade multiplayer real de um shard |

## 5. Itens resolvidos versus bloqueadores

### Código do protótipo — resolvido/automatizado

- [x] Revisão dos subsistemas Data, World, Game, Network, API e infraestrutura.
- [x] PRs pequenos com testes e histórico GitHub; `main` não modificada.
- [x] Testes por SO + integração PG16 e smoke compilado.
- [x] Documentação dos 12 endpoints REST e dos contratos do Unity.
- [x] Migration **baseline para DB nova** com segurança e repetição em CI.
- [x] Matriz de validação e instruções locais claras para o proprietário.

### Assinatura local obrigatória — AINDA ABERTA

- [ ] Fases 5.2 e 6.2: Unity autenticado, viewport, desconexão, shutdown e PostgreSQL no Windows real.
- [ ] Fase 7.2: duas contas, personagens, Guild, negações, persistência e reinício.
- [ ] Fase 8.2: toda matriz funcional de cliente, timers, mapa, UI e banco de teste; registros sem dados sensíveis.
- [ ] Fase 8.3: assinatura de `backend validado localmente` e encerramento **integral** do projeto.

### Roadmap operacional separado — fora da homologação do protótipo

1. Migração de bancos **já populados** e validação de `accountId` nulo, dados JSONB legados, XP/gold/position; testar sempre com cópia restaurável e migração revisada.
2. Infra de Internet/produção: TLS, reverse proxy com IP confiável, rate limiting distribuído/anti-DDoS, configuração de secrets, logs/retention e observabilidade de múltiplas instâncias.
3. Testes de carga reais (latência de rede, conexão simultânea, filas e benchmarks em máquina representativa). Benchmark sintético não é SLA.
4. Aprimoramento futuro de UI cliente — por exemplo, painel de loot, visualização de pesca — sem confundir lacuna visual com bug de backend.
5. Funcionalidades NOVAS como spells, party, houses, pathfinding avançado e sistemas sociais adicionais não fazem parte do escopo da refatoração encerrada.

## 6. Encerramento técnico (condicional)

**A implementação e a validação automatizada da refatoração estão concluídas para a `dev` depois da CI final**, sem exigência de publicar `main` ou implantar produção. **O sign-off completo das Fases 7 e 8 continua deliberadamente pendente** até os testes locais do responsável, conforme `docs/PHASE8_POSTGRES_WINDOWS_QA.md` e `docs/PHASE8_FINAL_VALIDATION.md`.

Registrar no Notion qualquer falha local junto do SHA testado, resultado esperado/observado e evidência anonimizada; corrigir em PRs pequenos, testar e validar na `dev` antes de marcar fechamento final.
