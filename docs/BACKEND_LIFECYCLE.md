# ZagoQuest — Etapa 1.10: Backend Lifecycle

**Branch:** `refactor/backend-lifecycle`  
**Base encadeada:** `refactor/backend-combat-events` (Etapa 1.9, PR #9).  
**Escopo:** inicialização, loops, timers, rede, HTTP, jobs e encerramento do banco. Sem alterar combate, economia ou mensagens do Unity.

## Diagnóstico

| Classificação | Local | Problema anterior |
|---|---|---|
| **Bug real** | `gameStarter.ts` | Loop de IA/autoattack era `setInterval` sem handle nem `clearInterval`; continuava após SIGTERM e podia iniciar duas vezes |
| **Bug real** | `shutdownHandler.ts` | Fazia autosave e chamava `process.exit()` sem fechar WebSocket, HTTP, condições, timers ou PostgreSQL |
| **Bug real** | `main.ts` | `try/catch` ao redor de `server.listen()` não captura erros assíncronos como `EADDRINUSE` |
| **Bug real** | `api/server.ts` | `process.exit(1)` em falha de conexão, contornando limpeza do bootstrap |
| **Bug real** | `scheduledTasks.ts` | Shutdown aguardava salvamento, mas não esperava job de manutenção de guildas antes de desconectar PostgreSQL |
| **Bug real** | `DeathSystem` / condições | Respawn, expiração de corpses e timers de condição/pesca podiam manter processo vivo e agir depois do shutdown |
| **Dívida técnica** | `wsServer.ts` | Faltava método público e idempotente para parar aceitações, esperar handlers ativos e encerrar conexões |
| **Dívida técnica** | Sinais do processo | Parte do shutdown estava dentro do `gameStarter`; inicialização/encerramento não tinham um dono único |

## Modelo de recursos e shutdown

A função `bootstrap` em `server/src/main.ts` é a **dona dos recursos** que cria. Cada etapa registra um handle (HTTP, WS, mundo, loops) e consegue encerrar só o que já foi inicializado — inclusive no meio de um erro.

```text
                      INICIALIZAÇÃO
Registros → PostgreSQL → Mundo/Player → WebSocket →
HTTP.listen() aguardado → IA/Autosave/Guildas → SIGINT/SIGTERM
                              │
                              ▼
                 DESLIGAMENTO (idempotente)
 1. Parar loop/timers periódicos
 2. Bloquear mensagens novas e drenar handlers WebSocket ativos
 3. Encerrar clientes WebSocket
 4. Encerrar HTTP, aguardando requisições ativas
 5. Cancelar timers de respawn/corpo, condições, pesca, sessões NPC
 6. Aguardar manutenção de guildas em andamento
 7. Aguardar autosave anterior e salvar ÚLTIMA versão do jogador
 8. Desconectar PostgreSQL (inclusive se o último save falhar)
 9. Configurar process.exitCode (0 se tudo certo, 1 se houve falha)
```

A ordem foi pensada para impedir novos comandos de jogador **após** o salvamento final. Não usamos `process.exit(0)` como atalho: Node encerra naturalmente quando não há conexões/timers que o mantenham ativo.

### `startGameLoops()` e `tickWorld()`

- O tick de jogo continua de **1.500 ms**, sem mudança na IA/combat.
- Autosave permanece em **60 segundos**.
- Guildas permanecem em **24 horas**.
- `startGameLoops(world, player, wsServer)` agora retorna um `GameLoopsHandle` com `stop()`, `flushAutosave()` e `waitForTasks()`.
- Um segundo `startGameLoops()` para **o mesmo mundo** reutiliza o handle, sem duplicar intervalos.
- `stop()` limpa timer do jogo e timers periódicos, e torna callbacks antigos inoperantes.
- Em testes, timers/dependências podem ser injetados sem usar clock real.

### `WebSocketServer.close()`

- Sinaliza `stopping` e impede mensagens e conexões novas.
- Aguarda `OrderedMessageQueue.whenIdle()`: handlers que já começaram podem terminar; handlers enfileirados e ainda não executados são descartados.
- Termina os sockets ativos e espera o `wss.close()`.
- Remove o `CombatEventBridge` do `EventSystem`, evitando listeners de mundo antigo.
- Encerra a sessão de NPC pelo evento de desconexão.
- É idempotente: chamadas repetidas compartilham a mesma Promise.

**Importante:** fechar o WebSocket **não fecha a API REST**; `closeHttp()` é uma etapa independente, executada em seguida.

### `httpLifecycle.ts`

`listenHttp(server, port)` trata eventos `error` e aguarda o callback real de escuta. Uma porta ocupada (`EADDRINUSE`) rejeita a inicialização e aciona o cleanup; os loops não começam. `closeHttp()` é seguro mesmo para um servidor que nunca chegou a escutar.

`resolveApiPort()` mantém padrão `3000`, rejeita valores inválidos e permite `0` para testes com porta aleatória.

### `ShutdownController` e sinais

```ts
const shutdown = createShutdownController({ ...dependencies });
setupGracefulShutdown(shutdown);
```

- `shutdown("SIGINT")` e `shutdown("SIGTERM")` compartilham a mesma Promise — o save final acontece uma vez.
- Cada passo é tentado mesmo que o anterior falhe. A conclusão retorna **0** ou **1**.
- `setupGracefulShutdown()` aceita emissor de sinais e callback injetáveis, para testes sem desligar o processo.
- Os listeners de sinais são removidos após o shutdown.
- A falha de salvamento final **não** é noticiada como sucesso; o código de saída será 1.
- Em falha durante bootstrap, o mesmo controller limpa apenas recursos já adquiridos.

### Recursos de mundo: `stopWorldRuntime()`

- `DeathSystem` passa a agrupar timers de respawn/corpse por `World`, usando `WeakMap`.
- `stopWorldRuntime(world)` cancela esses timers, efeitos periódicos/condições, cooldowns e pesca.
- Cancela estados voláteis de autoattack e sessão econômica, mas **não modifica gold, XP, inventário ou posição**.
- É seguro chamar mais de uma vez.

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `server/src/main.ts` | Bootstrap e ownership dos recursos |
| `server/src/api/server.ts` | Inicialização do banco sem `process.exit` |
| `server/src/game/core/httpLifecycle.ts` | Listen assíncrono e close do HTTP |
| `server/src/game/core/shutdownHandler.ts` | Shutdown ordenado e handling de sinais |
| `server/src/game/core/gameStarter.ts` | Loop cancelável e idempotente |
| `server/src/game/core/scheduledTasks.ts` | Aguarda job de guildas ativo |
| `server/src/game/core/worldCleanup.ts` | Para efeitos/timers temporários |
| `server/src/game/systems/deathSystem.ts` | Rastreamento e cancelamento de timers |
| `server/src/network/websocket/wsServer.ts` | Drenagem e fechamento de sockets |
| `server/src/network/validation/messageGuards.ts` | `OrderedMessageQueue.whenIdle()` |
| `server/tests/lifecycle.test.ts` | Regressões de shutdown, timers e HTTP |
| `server/tests/lifecycleSocket.test.ts` | Integração real de fechamento de WebSocket |
| `server/package.json` + workflow | CI com toda a suíte de regressões |

## Testes automatizados

Com `npm ci && npm run build && npm test`, executar:
- idempotência de loop e shutdown;
- stop e callbacks antigos sem atividade;
- restart do loop após stop;
- falha de save com fechamento de banco mesmo assim;
- falha de HTTP/WS com tentativa das demais limpezas;
- dois sinais (Ctrl+C + SIGTERM) sem save duplicado;
- porta ocupada (`EADDRINUSE`) e porta inválida;
- drenagem de fila WebSocket antes do encerramento;
- manutenção de guildas antes do último save;
- cancelamento de pesca, efeitos e timers de corp/reaparecimento;
- WebSocket real, socket fechado, cleanup do `CombatEventBridge` e HTTP isolado.

## Smoke tests manuais (Windows 11, PostgreSQL, Unity)

Com a branch sincronizada, a partir da pasta `server`:

```powershell
git fetch origin
git switch --track origin/refactor/backend-lifecycle
npm ci
npm run build
npm test
npm run dev
```

### Cenários sugeridos

1. **Boot normal:** API e Unity conectam, world/mapa, NPCs e monstros aparecem; movimento, combate e XP funcionam.
2. **Ctrl+C (SIGINT):** log de shutdown em ordem; um último save; processo libera porta HTTP; PostgreSQL fecha.
3. **Novo boot:** iniciar `npm run dev` novamente na mesma porta; sem `EADDRINUSE`.
4. **Porta ocupada:** executar uma segunda instância enquanto a primeira está de pé; a segunda deve reportar `EADDRINUSE` e sair com erro, **sem iniciar loops**, sem derrubar a primeira.
5. **SIGTERM:** no Windows, se disponível, enviar sinal via ferramenta que suporte SIGTERM (Ctrl+C já cobre SIGINT); validar shutdown sem duas gravações.
6. **Reconexão:** fechar o cliente Unity, reiniciar o servidor, conectar de novo; sem estado antigo de alvo/NPC.
7. **Persistência:** mudar gold/XP/posição, desligar e iniciar novamente; dados persistem.
8. **Autosave lento/falha do banco:** inspecionar que salva em série e relata falha (não registra sucesso falso).
9. **Monstro morreu perto do shutdown:** verificar no novo boot que temporizadores antigos não fazem despawn/respawn na sessão nova.

## Limitações que permanecem

- **Falha abrupta** (queda de energia, `taskkill /F`, `SIGKILL`) **não** dispara shutdown gracioso. A durabilidade depende do autosave anterior.
- Uma operação externa pendente (PostgreSQL travado ou requisição HTTP que nunca termina) pode prolongar o shutdown: ainda não existe limite máximo de espera com hard-kill, intencionalmente para evitar abortar o save sem aviso.
- `startScheduledTasks` segue global para uma instância de jogo; verdadeiro multi-world/multi-user exige scheduler por mundo e persistência por personagem.
- `DatabasePersistence` salva um único jogador inicial, não todas as contas.
- WebSocket **ainda não autentica JWT/sessões por personagem**. Mesmo com lifecycle correto, não está pronto para publicação pública.
- Dano periódico de condições (veneno, queimadura) ainda requer revisão própria para usar o pipeline único de combate.
- O Unity não é compilado pela CI do backend: validar o cliente localmente.
- Vulnerabilidades de dependências (`npm audit`) continuam reservadas para revisão final, conforme combinado.

**PR deve permanecer draft e não ser mesclado até CI verde e smoke tests.**
