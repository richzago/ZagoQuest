# ZagoQuest — Etapa 1.9: Combat Events

**Branch:** `refactor/backend-combat-events`  
**Base do PR:** `fix/backend-network-contracts` (Etapa 1.8).  
**Tipo de trabalho:** refactor com correções de bugs reais, preservando o protocolo Unity/Node.

## 1. Diagnóstico: o que havia de errado?

| Categoria | Onde | Problema comprovado |
|---|---|---|
| **Bug real** | `attack.handler.ts` | `ctx.broadcast.broadcastDamage` já envia ao cliente, mas `ctx.packetSender.combat.sendDamage` enviava outra notificação do mesmo dano ao atacante |
| **Bug real** | `attack.handler.ts` + `DeathSystem` | O `DeathSystem` já fazia `broadcastDespawn` ao matar um monstro, enquanto o handler manual fazia o mesmo broadcast novamente |
| **Bug real** | `handleAttack` | Não havia cooldown de combate por jogador: um cliente podia enviar ataques repetidos no ritmo da rede |
| **Inconsistência** | `gameStarter.ts` versus `attack.handler.ts` versus `MonsterAI` | Cada origem de ataque cuidava da notificação de dano de um jeito; golpes feitos pelo monstro não usavam o mesmo caminho de broadcast |
| **Bug real** | `CombatSystem.attack` | Podia devolver dano maior que o HP efetivamente perdido (overkill), e não impedia atacante morto ou monstro já removido do mundo |
| **Dívida técnica** | Sistema geral de eventos | Os eventos de dano/morte não incluíam mundo nem HP máximo; não bastavam para traduzir com segurança o payload `damage` do WebSocket |

A proteção de `deathProcessed` para **mortes únicas**, criada na etapa de spawns, foi preservada. Não houve reescrita de loot, XP, cadáveres nem respawn.

## 2. Novo fluxo autoritativo

```text
Unity envia { type: "attack", targetId }
          │
          ▼
attack.handler.ts ──► PlayerAttackSystem.tryAttack
                            │
                            ├─ personagem vivo?
                            ├─ monstro no mundo e vivo?
                            ├─ alcance até 1,5 unidades?
                            └─ cooldown de 1000ms compartilhado?
                                     │
                                     ▼
                              CombatSystem.attack
                                     │
                                     ├─ fórmula do dano
                                     ├─ subtrai HP real
                                     ├─ emite GameEvent.COMBAT_DAMAGE
                                     │              │
                                     │              ▼
                                     │       CombatEventBridge
                                     │              │
                                     │              └─ broadcastDamage UMA vez
                                     │
                                     └─ se HP chega a zero: DeathSystem
                                                ├─ concede XP ao killer
                                                ├─ gera loot e corpse
                                                ├─ emite MONSTER_DEATH
                                                │          └─ CombatEventBridge:
                                                │             monsterDied ao killer
                                                ├─ despawn UMA vez
                                                └─ agenda respawn da próxima vida
```

O loop automático também usa `PlayerAttackSystem.tryAttack()`. O movimento/IA dos monstros mantém o próprio cooldown, mas todo golpe deles aplica dano através de `CombatSystem.attack`; assim `COMBAT_DAMAGE` também produz broadcast quando o atacante é um monstro.

## 3. `PlayerAttackSystem`: entrada única para ataques do jogador

`server/src/game/combat/playerAttackSystem.ts` centraliza:
- identidade do alvo e existência no `World`;
- HP positivo do jogador e do monstro;
- distância Euclidiana máxima **1,5** (regra já existente no handler manual);
- **1000 ms de cooldown**, compartilhado com ataque automático, usando `player.cooldownManager`;
- somente após validação, chama `CombatSystem.attack`.

```ts
const result = PlayerAttackSystem.tryAttack(player, monster, world);
if (!result.ok) {
  packetSender.combat.sendAttackFailed(result.reason);
  return;
}
```

O ataque manual retorna `attackFailed` no cooldown ou erro. O loop automático ignora o resultado de cooldown e tentará novamente no próximo tick. Ataques bloqueados por distância ou alvo morto não gastam cooldown.

**Ajuste de balanceamento:** o loop atual processa ataques automáticos a cada **1500 ms**, enquanto o cooldown mínimo é **1000 ms**. Isso mantém a cadência atual do auto attack e impede rajadas por ataque manual. Valores são constantes para ajuste posterior.

## 4. `CombatEventBridge`: eventos viram mensagens de rede

`server/src/network/websocket/combatEventBridge.ts` escuta os eventos:
- `GameEvent.COMBAT_DAMAGE` → transmite `{type:"damage",targetId,newHp,maxHp,damage}` a todos os clientes conectados;
- `GameEvent.MONSTER_DEATH` → envia `{type:"monsterDied",monsterId}` **somente** ao jogador que matou.

O `DeathSystem` continua sendo responsável pelos broadcasts de `spawn` (corpse) e `despawn` do monstro.

A ponte é registrada **uma vez por `WebSocketServer`** e é removida no evento `wss.close` via `dispose()`. Como `EventSystem` é singleton, incluir a referência `world` nos dados internos do evento é essencial para impedir que dois servidores/mundos dentro do mesmo processo recebam notificações cruzadas.

`world` não vira campo do JSON de rede. É apenas o contexto do evento dentro do servidor.

### Por que não transmitir pelo handler?

O handler manual não é chamado quando um monstro ataca um jogador. Se nele residir o broadcast, ataques de origens diferentes exigem duplicar envio de mensagens. Quando **o próprio sistema de combate emite o evento**, todas as origens usam o mesmo caminho, sem depender da intenção do pacote.

## 5. Dano real versus dano calculado

Antes:
```ts
const damage = result.damage; // Pode ser 30 em um alvo com 1 HP.
target.hp = Math.max(0, target.hp - damage);
return damage; // Cliente via 30, mas só 1 HP desapareceu.
```

Agora:
```ts
const damage = Math.min(result.damage, target.hp);
target.hp = Math.max(0, target.hp - damage);
return damage;
```

O cliente vê o dano **efetivamente aplicado**. O algoritmo de crítico/resistência continua igual; apenas a representação de overkill mudou.

Um alvo morto ou monstro já processado/removido não emite novo evento de dano e não gera XP/corpo duplicado.

## 6. Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `game/combat/playerAttackSystem.ts` | Novo guard de ataque do jogador, alcance e cooldown |
| `network/websocket/combatEventBridge.ts` | Nova ponte de eventos do domínio para WebSocket |
| `shared/interfaces/eventData.interface.ts` | Campos `world` e `targetMaxHp` em evento de dano/morte |
| `game/combat/combatSystem.ts` | Dano aplicado exatamente uma vez e evento tipado |
| `game/systems/deathSystem.ts` | Evento de morte com contexto de mundo |
| `network/websocket/wsServer.ts` | Instala ponte e a remove no fechamento |
| `network/handlers/attack.handler.ts` | Sem broadcasts duplicados e com validação centralizada |
| `game/core/gameStarter.ts` | Auto attack com cooldown comum, sem segundo broadcast |
| `tests/combatEvents.test.ts` | Testes de regra e eventos do domínio |
| `tests/combatSocket.test.ts` | Testes de integração WebSocket reais |
| `server/package.json` + CI | Executa regressões com a suíte existente |

## 7. Testes

Os testes verificam:
- um `COMBAT_DAMAGE` para cada golpe válido, com HP máximo e dano real;
- golpes de monstros também emitem o evento de dano;
- cliente não recebe mensagens de outro `World`;
- remover a ponte remove listeners do EventSystem;
- atacante morto ou alvo removido não conseguem causar dano;
- overkill gera só o dano efetivo;
- morte emite um evento `MONSTER_DEATH` e uma recompensa de XP;
- `monsterDied` chega ao killer, não a um monstro ou outro mundo;
- handler manual não chama broadcast diretamente;
- cooldown de jogador cobre ataque manual e automático;
- integração WebSocket de `attack`, `attackFailed`, `autoAttackStarted`, `damage`, `monsterDied` e `despawn` verifica contagem de pacotes.

### Rodar no Windows (dentro de server/)

```powershell
git fetch origin
git switch --track origin/refactor/backend-combat-events

npm ci
npm run build
npm test
```

## 8. Smoke tests Unity antes do merge

- [ ] Um ataque manual gera **um único texto de dano** no alvo.
- [ ] Spam de tecla/ataque manual recebe `attackFailed: Ataque em cooldown` e não causa dano extra.
- [ ] Ataque automático mantém aproximadamente o ritmo anterior (tick 1,5s).
- [ ] Monstro atacando o jogador atualiza HP na HUD e exibe dano uma vez.
- [ ] Ao matar monstro, XP e loot são gerados uma vez; cliente remove o monstro uma vez.
- [ ] Após respawn, monstro novo tem novo ID e pode receber dano normalmente.
- [ ] Com diferentes clientes/mundos de teste, não há vazamento de eventos entre mundos.
- [ ] Auto attack é interrompido após a morte/desaparecimento do alvo.
- [ ] Verificar logs e ausência de mensagens `Tipo de mensagem não tratado` no Console Unity.

## 9. Limites da etapa e trabalho futuro

**Não incluído nesta etapa:**
- Dano periódico (**veneno, queimadura**): hoje `ConditionManager.onTick` usa `target.takeDamage`, sem encaminhar a `CombatSystem` ou `DeathSystem`. Isso é uma **falha real** separada: o tick pode reduzir HP a zero sem gerar os mesmos eventos de dano/morte/XP. Requer transportar o contexto de `World`/atacante para o processamento das condições, sem acoplamento circular; planejar etapa específica de `combat-conditions` antes de disponibilizar DoT no jogo público.
- `CooldownManager` usa `Date.now` (relógio de sistema); futuramente considerar monotônico como no movimento.
- A morte do jogador ainda faz respawn imediato em `(0,0)`. A revisão de pontos de respawn e penalidades fica separada.
- Proteções de login/JWT do WebSocket ainda não implementadas. O servidor não está pronto para exposição pública.
- Análise de vulnerabilidades de dependências via `npm audit` permanece para o final, conforme combinado.

**PR permanece draft até testes automatizados concluídos e smoke test no Unity.**
