# ZagoQuest — Etapa 1.5: movimento autoritativo

**Branch:** `fix/backend-movement`  
**Base do PR:** `fix/backend-scheduled-tasks` (PR encadeado).  
**Arquivos:** `game/systems/movementSystem.ts`, `network/handlers/move.handler.ts`, `game/world/World.ts`.  
**Testes:** `server/tests/movement.test.ts`.

## 1. Problemas confirmados no código anterior

1. O handler `move` recebia `{x,y}` e aceitava qualquer destino caminhável. Assim, de (2,2) para (90,90) era um **teleporte autorizado pelo servidor**, desde que o tile final estivesse livre.
2. `moveDir` aplicava sucessivos comandos imediatamente, sem uma frequência mínima; clientes alterados podiam mandar pacotes mais rapidamente que o Unity.
3. Uma diagonal validava somente o destino. O jogador podia atravessar o canto de paredes/entidades quando os dois tiles laterais eram bloqueados.
4. A conversa com NPC era interrompida ao afastar-se via `move`, **mas não** via `moveDir` (WASD).
5. Movimentação não cancelava a pesca em andamento, apesar de `FishingSystem.cancelFishing` já existir.
6. Um monstro morto ainda bloqueava passagem até o cleanup do game loop (~1,5 segundo).

## 2. Regra de servidor: apenas UM tile por pedido

```
Unity ── {type:"moveDir", dir:"east"} ───┐
                                       ├─► MovementSystem ──► World.isPositionWalkable
Unity ── {type:"move", x:3, y:2} ───────┘             │
                                                       ├─ aceito: atualiza posição
                                                       │          confirma ao jogador
                                                       │          broadcast aos demais
                                                       │          cancela pesca, verifica NPC
                                                       └─ negado: confirma posição verdadeira
```

`MovementSystem.moveTo` aceita somente `dx,dy` dentro de `[-1,1]` e não ambos zero. Exige `Number.isSafeInteger` nos pares coordenados e na posição atual, rejeita jogador morto e não confia na posição enviada pelo cliente.

`moveDir` consulta o mapa de oito direções e chama a **mesma** função de `moveTo`. Direções inexistentes, valores não string e chaves herdadas do JavaScript (`"constructor"`, `"__proto__"`, etc.) são rejeitadas.

**Importante:** `move` absoluto agora significa mover para **um tile adjacente**, NÃO teletransportar ou andar automaticamente até um destino distante. Um sistema de clique-a-caminho deverá calcular uma rota com A* (ou equivalente) e enviar cada passo, ou pedir um destino a um pathfinder autoritativo do servidor. Não confundir a correção de teleporte com implementação de pathfinding.

## 3. Cooldown

`MIN_MOVE_INTERVAL_MS = 150` em `movementSystem.ts`.

- O relógio usa `performance.now()` (monotônico, melhor para duração que `Date.now()`).
- Guarda o instante do último passo **aceito** em `WeakMap<Player,number>`.
- Tentar andar 149 ms depois do passo anterior: `"cooldown"`.
- Tentar 150 ms depois: permitido, se passar nas outras validações.
- Movimentos bloqueados, inválidos e no-ops **não** gastam tempo.
- Alternar `move` e `moveDir` não contorna a restrição; ambos compartilham o mesmo `WeakMap`.
- O mesmo jogador ligado a vários sockets compartilha a regra, mas **autorização correta de socket→personagem ainda é necessária**.

O parâmetro `now` é opcional e permite testar tempos artificiais sem pausas reais.

**Balanceamento:** `150ms` é um ponto inicial, não velocidade final. O Unity expõe `stepDuration = 0.2f` (200ms), mas nem todo input usa essa propriedade; revisar controles e percepção após smoke test.

## 4. Colisões e diagonais

`World.isPositionWalkable` considera limites, terreno e entidades. Para diagonal, além do destino:
- verifica (`fromX + dx, fromY`),
- verifica (`fromX, fromY + dy`).

Se um dos lados está bloqueado, cancela a diagonal. Essa regra intencionalmente **impede cortar cantos** (mesmo que só um lado esteja bloqueado).

`World.isPositionOccupied` deixa de considerar monstro com `hp <= 0` como obstáculo, antes do cleanup.

## 5. Sincronização de rede e efeitos pós-movimento

`move.handler.ts` centraliza os dois comandos:
- sempre envia `{type:"position",x,y}` com a **posição real** para o cliente que tentou mover;
- transmite `{type:"move",id,x,y}` aos demais sockets **somente** se o passo ocorreu;
- só após movimento real chama `FishingSystem.cancelFishing(player)`;
- termina conversa com NPC por `/bye` quando a distância Manhattan fica **maior que 2**, igualmente em `move` e `moveDir`.

Os dois handlers são `async` para permitir reutilizar a rotina de chat do NPC. O despacho atual de WebSocket já aceita handlers `Promise<void> | void`.

## 6. Testes

O novo `server/tests/movement.test.ts` cobre:
- direções cardinal/diagonal e passo único;
- teleporte distante, no-op, `NaN`, `Infinity`, strings, floats e valores não numéricos;
- jogador morto/posição de origem inválida;
- paredes, bordas, NPCs, jogadores, monstros vivos e monstros mortos;
- corte de canto com paredes e entidades;
- direção `__proto__`;
- cooldown de 149ms/150ms e alternância entre os protocolos;
- confirmação de posição verdadeira em rejeição, broadcast só em sucesso;
- saída de conversa NPC por WASD;
- cancelamento de pesca só depois de mover de fato.

Testes usam o mundo simulado `World.generateMap(10,10)` e spies mínimos de comunicação, sem PostgreSQL ou Unity.

```powershell
# Já dentro de server/
git fetch origin
git switch --track origin/fix/backend-movement
npm ci
npm run build
npm test
```

Se a branch já existir: `git switch fix/backend-movement` e `git pull --ff-only origin fix/backend-movement`.

## 7. Checklist manual Unity

- [ ] WASD percorre um tile por comando, sem travar por causa do intervalo.
- [ ] Q/E/Z/C executam diagonais permitidas.
- [ ] Nenhuma diagonal atravessa parede/entidade pelo canto.
- [ ] Mover contra parede recebe posição verdadeira sem salto.
- [ ] Movimentação retorna ao normal após parada e retomada.
- [ ] Afastar-se de NPC encerra conversa tanto no WASD quanto em comandos absolutos.
- [ ] Mover cancela pesca; tentativa bloqueada não cancela.
- [ ] Reabrir jogo mantém posição persistida corretamente.
- [ ] Com dois clientes, conferir sincronização; a associação de socket→personagem é assunto da etapa de segurança.

## 8. Limitações e decisões futuras

- O WebSocket atual associa todo novo socket a `world.players[0]`. **Esse é um problema real e grave**, mas deve ser corrigido com autenticação/sessões na etapa apropriada, não inventando identidade pelo pacote de movimento.
- O controle de 150ms evita rajadas de movimentação, não é um limitador global de pacotes do servidor. O rate limiting de mensagens fica para segurança da rede.
- Pathfinding, aumento de velocidade, bônus/slow de condições, barcos/teleportes autorizados e teleportes de GM não foram implementados. Eles devem usar rotas server-side distintas do comando de um passo.
- A direção norte é `+Y`, conforme o PlayerController/Unity atual. Alterar convenção exige alteração coordenada do servidor e cliente.
- Revisão de dependências/`npm audit` foi adiada a pedido do projeto.
- O PR permanece em draft até CI verde e verificação manual.
