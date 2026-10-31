# Fase 4 — Consistência de gold entre REST, gameplay e PostgreSQL

## Diagnóstico confirmado em `dev`

`GuildService.createGuild` já usava uma transação PostgreSQL e `pessimistic_write`, mas debita `Character.gold` lendo do banco. `Player.gold` do servidor online podia conter um saldo mais novo, alterado por loot/loja/banco. O autosave depois sobrescrevia o débito da guilda com o gold antigo da memória. Um lock SQL sozinho não corrigia esse conflito de fontes de verdade.

## Regra da correção

1. **Player online** (`OnlinePlayerDirectory`, ligado ao `world.players`): carteira em memória é a referência da sessão. **Offline:** o registro PostgreSQL bloqueado é a referência.
2. A transação de guilda identifica `Character`, valida permissão de compra e, com Player online, **reserva a taxa de 20.000 gold antes da gravação assíncrona**. A carteira disponível diminui imediatamente, impedindo gastos da taxa durante o `await`.
3. O código preserva espaço para devolução em caso de rollback, inclusive no teto `MAX_GOLD`. Isso exige que loot/Gold, shop/sell e bank/withdraw usem `Player.canReceiveGold` ao creditar na carteira.
4. `withCharacterWriteLock(uuid)` serializa o autosave e a cobrança REST do mesmo UUID no processo. Jogadores diferentes continuam independentes. A linha PostgreSQL segue protegida por `pessimistic_write` dentro da transação.
5. **Após COMMIT:** confirma reserva e envia o contrato existente do Unity `{ type: "gold", gold }` ao personagem online. **Em falha de transação:** devolve a reserva; não envia sucesso nem registra a guilda.
6. A conexão do registro do mundo é liberada no shutdown; ele não cria nem autentica novas sessões — responsabilidade da Fase 5.

## Arquivos

- `server/src/game/systems/onlinePlayerDirectory.ts` — consulta Player ativo por nome.
- `server/src/game/systems/characterWriteLock.ts` — fila de operações por UUID.
- `server/src/game/entities/player.ts` — reserva/commit/rollback e limite de crédito.
- `server/src/api/services/guildService.ts` — cobrança integrada à carteira online.
- `server/src/game/systems/databasePersistence.ts` — autosave serializado com operações REST.
- `server/src/game/systems/bankingSystem.ts` e `shopSystem.ts` — controle de crédito durante reservas.
- `server/src/main.ts` — registro e cleanup do mundo para economia REST.
- `server/tests/onlineGuildGold.test.ts` — regressões novas.

## Limites e testes ainda obrigatórios

- Este PR corrige **a cobrança de criação de guilda**. Não torna cada compra, loot ou banco uma transação instantânea no PostgreSQL: essas mutações continuam em memória e são persistidas pelo autosave.
- O lock por UUID é **somente deste processo Node**, não substitui transações SQL entre processos diferentes. Se surgirem múltiplas instâncias do backend, será necessário modelo de sessão distribuída e concorrência transacional adicional.
- Antes de encerrar a Fase 4, validar no PostgreSQL de **teste**: rollback real (erro em criação de membro), concorrência de chamadas de guilda, save enquanto online, dados JSONB antigos, migrations versionadas e recuperação de backup.
- Nenhum script DDL, migration ou alteração do `.env` é necessário neste PR. Não executar testes de falha contra a base `zagoquest` principal.
- A Fase 5 só deve integrar autenticação WS e multiplayer após o teste local e a CI desta correção. Não trocar `world.players[0]` por outro mecanismo sem validar autenticação JWT, `characterId` e propriedade do personagem.

## Atualização no Windows

Primeiro certificar-se de que há backup restaurável e de que `server/.env` aponta para `zagoquest_test` (`DB_SYNCHRONIZE=false`):

```powershell
git status
git fetch origin
git switch -c fix/phase4-guild-online-gold --track origin/fix/phase4-guild-online-gold
cd server
npm ci
npm run build
npm test
npm run dev
```

Se a branch já existir: `git switch fix/phase4-guild-online-gold` e `git pull --ff-only origin fix/phase4-guild-online-gold`. Não usar `reset --hard`, não compartilhar JWT ou senha.

**Smoke test manual:** personagem de teste com nível >= 100, carteira >= 20.000 e conta com permissão. Ganhar/usar gold no jogo e confirmar que o saldo apresentado é o mesmo que a cobrança usa. Criar guilda uma vez e verificar carteira online e `characters.gold`. Encerrar com Ctrl+C, reiniciar e comparar. Teste de rollback/erro simulado só na base isolada e com roteiro específico.


## Integração real com PostgreSQL descartável (CI)

A partir deste PR, `npm run test:pg` exercita o PostgreSQL 16 real em um **job separado Linux**, usando serviço efêmero criado pelo GitHub Actions. `DB_SYNCHRONIZE=true` é usado **apenas para criar o schema dessa base descartável** e não comprova migrations versionadas. Windows/Linux continuam executando o conjunto normal de testes.

O arquivo `tests/phase4PostgresIntegration.test.ts` recusa executar sem TODAS as variáveis `RUN_PG_TESTS=true`, `NODE_ENV=development` e `DB_NAME=zagoquest_ci`, evitando a execução acidental contra `zagoquest` ou `zagoquest_test` do usuário. O job executa operações SQL somente na base isolada `zagoquest_ci`.

Cenários: saldo online versus registro SQL desatualizado e autosave, débito offline, rollback transacional real mediante trigger temporária que força erro após desconto, e duas criações concorrentes que devem resultar em uma única cobrança e membro.

A aprovação desses testes comprova apenas o ambiente PostgreSQL descartável da CI. Não substitui backup/restauração e teste de jogo local; não valida dados históricos da base do usuário nem migrations TypeORM.
