# ZagoQuest — Etapa 1.3: Monster Spawns

**Branch**: `fix/backend-monster-spawns`  
**Base**: `fix/backend-inventory-economy` (PR encadeado).

## Problemas confirmados

1. `MonsterLoader.spawnMonsters()` chamava `world.addMonster(monster)` **duas vezes** e adicionava `world.spawnPoints` **duas vezes** por spawn. Isso significava a *mesma referência de monstro* repetida no array do mundo.
2. `DeathSystem.handleDeath()` não evitava processar a mesma morte duas vezes: XP, loot, corpse, eventos e timers podiam duplicar.
3. O ID guardado no `spawnPoint` era o ID temporário da primeira vida; um respawn cria outro ID, tornando a relação obsoleta.
4. `respawnTime` inválido poderia se tornar timer quase imediato.
5. A mudança anterior no `tsconfig.json` (saída `dist/`) não copiava JSONs; `MonsterRegistry` e `ConditionRegistry` procuravam arquivos ao lado do JS compilado.
6. `MonsterAI` e o loop do jogo podiam processar monstros mortos antes do cleanup.

## Convenção de IDs

Cada objeto da layer `MonsterSpawn` representa um **ponto fixo**. Esse ponto tem um `spawnPointId` que não muda entre mortes.

Cada vida do monstro ganha um **ID de entidade novo** para o protocolo de spawn/despawn e ataques.

```
Tiled MonsterSpawn (ponto A) [id estável]
  └── Monster #1 [id entidade 1] → morte → corpse + XP
       └── timer de respawn
             └── Monster #2 [id entidade 2, mesmo ponto A]
```

O `MonsterLoader` registra **um ponto** e **uma entidade** por objeto válido. `World.addMonster` bloqueia IDs de entidade repetidos como proteção adicional. Spawns **diferentes** podem ocupar a mesma coordenada: são entidades diferentes.

## Proteções do ciclo

`Monster.deathProcessed` começa como `false`. Na primeira chamada válida a `DeathSystem.handleDeath`, passa para `true` *antes* dos efeitos. Chamadas repetidas são ignoradas. Mortes de monstros já removidos do mundo também são ignoradas.

`Monster.respawnTime` valida inteiros positivos até o limite dos timers do Node; valores inválidos voltam para **10000ms**. Depois do timer, o sistema verifica o limite do mundo e impede uma segunda entidade viva para o mesmo `spawnPointId`.

O respawn **não cria outro** `world.spawnPoint`; reutiliza o ponto de origem do monstro. A IA não processa monstros mortos e o loop também os pula.

## JSONs em dev e dist

`tsc` só gera `.js`; ele não copia JSONs. O `MonsterRegistry` lê arquivos em `process.cwd()/src/data/monsters`, e o `ConditionRegistry` lê `process.cwd()/src/data/items/conditions/conditions.json`.

Assim `npm run dev` e `npm start` (após `npm run build`) encontram os arquivos **desde que o diretório atual seja `server/`**.

Este comportamento acompanha o restante do projeto, que já lê itens e mapa a partir de `process.cwd()`. Um empacotamento autônomo futuro deverá copiar os assets e ajustar esses caminhos.

## Testes

Em `server/`:

```bash
npm ci
npm run build
npm test
```

Arquivo novo: `tests/monsterSpawns.test.ts`. Testa pontos únicos, múltiplos spawns, IDs repetidos, posições fora do mapa e bloqueadas, timeout inválido, morte idempotente, XP/corpo únicos, respawn com nova entidade no mesmo ponto, proteção de duplicação e IA de criatura morta.

Os testes de XP e economia continuam na mesma suíte.

## Escopo intencionalmente adiado

- Cancelar timers globais ao desligar/recarregar o mundo (lifecycle).
- Decidir se um ponto ocupado deve atrasar respawn em vez de gerar entidade sobre outro ator.
- Rate limiting, autorização de WebSocket e validação de combate do cliente.
- Balancear quantidade/densidade de monstros no mapa.
- Refatoração mais extensa de `World`, `DeathSystem` e `MonsterAI`.

## Checklist antes do merge

- [ ] CI passa em `npm run build` e `npm test`.
- [ ] Unity: cada ponto Tiled gera um monstro, não dois.
- [ ] Matar um monstro concede XP/loot uma única vez.
- [ ] O corpo some e o monstro reaparece após `respawnTime`.
- [ ] O novo monstro pode ser morto e renascer novamente.
- [ ] Testar `npm start` a partir de `server/` com PostgreSQL local seguro.
- [ ] Manter este PR em draft até validação manual.
