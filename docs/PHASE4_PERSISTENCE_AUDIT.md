# Fase 4 — Persistência: auditoria, autosave multiplayer e PostgreSQL

> Estado: **primeiro PR implementado, validação CI/PG local pendente**. Branch base: `dev`. Nenhuma migration nem DDL neste PR.

## 1. Fluxo encontrado no código da dev

1. `main.ts` inicia `AppDataSource` via `startApi` e constrói mundo e jogador.
2. `worldFactory` chama `PlayerLoader.loadOrCreatePlayer(name, spawn)`.
3. `DatabasePersistence.loadCharacter(name)` localiza `Character` por nome, instancia `Player` com o UUID, lê XP, gold, banco, posição e JSONB (inventário/equipment/skills).
4. `PlayerLoader` da **dev analisada** reposiciona o jogador carregado no spawn e salva imediatamente. **PR #54** propõe restaurar posição persistida; está em draft e NÃO foi integrado à dev neste diagnóstico. Não sobrescrever seu trabalho.
5. O gameplay altera `Player` em memória (ex.: `BankingSystem` transfere wallet/bank; inventário/XP/posição são mutados em runtime).
6. `startGameLoops` ativa `startScheduledTasks`; antes deste PR, o scheduler recebia apenas o jogador inicial. A cada 60s, `DatabasePersistence.saveCharacter` lê a linha por UUID e salva a maior parte do estado do `Player`; ao shutdown aguarda e refaz um último save.
7. Ao reiniciar, o ciclo começa de novo. O schema **não** é migrado automaticamente a menos que o .env de desenvolvimento peça `DB_SYNCHRONIZE=true`.

## 2. Bugs, riscos e limites — não confundir status

| Achado | Classificação | Estado |
| --- | --- | --- |
| Autosave captura apenas o jogador do boot; novos players não são percorridos | limitação real do código | **corrigido neste PR** por roster dinâmico |
| Dois ciclos periódicos sobrepostos | protegido no scheduler anterior | preservado, com teste multiplayer |
| Falha em save A impede tentar B | risco no cenário multiplayer | **coberto neste PR** com `Promise.allSettled` |
| REST/GuildService altera `Character.gold` diretamente no PostgreSQL; `Player.gold` online permanece antigo e autosave pode sobrescrever o débito | **bug de integridade de alto risco** | **aberto, PR separado obrigatório** |
| JSONB/XP/HP/posição ainda são carregados sem validação forte | **risco de dados inconsistentes** | aberto |
| `saveCharacter` usa `findOne` + `save`, sem controle de versão de estado/linha; gravações diretas concorrentes ainda podem vencer | **risco de concorrência** | aberto |
| Criação de personagem pelo loader, sem conta, enquanto REST cria personagem ligado a uma conta | diferença de fluxos / risco de identidade | aberto para projeto de sessão na fase 5 |
| Migrations versionadas | infra ausente no DataSource analisado | aberto, NÃO rodar synchronize em produção |

**Nota:** o scheduler evita concorrência **entre seus próprios ciclos**. Não serializa `DatabasePersistence.saveCharacter` invocado por outros serviços/instâncias e não resolve alterações REST simultâneas. Não marcar a fonte de verdade como resolvida por este PR.

## 3. Mudança deste PR (sem alterações de dados)

- `startScheduledTasks` aceita `Player` legado ou função `() => readonly Player[]`.
- `gameStarter` fornece `() => world.players`; a lista é lida em **cada tick**.
- UUID duplicado na lista é processado uma única vez por ciclo.
- Saves de UUIDs distintos podem rodar em paralelo; o ciclo seguinte aguarda **todos**, inclusive os que falharam.
- No shutdown, encerra timers, espera todos os saves iniciados e faz **novo snapshot**, refletindo mudanças ocorridas durante o save anterior.
- Logs individualizam personagem e erro, sem imprimir credenciais.

Testes determinísticos: `server/tests/scheduledTasks.test.ts` cobre entrada/saída do roster, UUID duplicado, ciclo lento e retry quando um player falha. Manter CI Windows/Linux verde antes de integrar.

## 4. Procedimento seguro de backup (Windows + PostgreSQL)

**Não executar migrations nem simular falhas na base principal.** Primeiro identificar a base real lendo apenas `DB_NAME` do teu `server/.env` local. Nunca enviar o .env nem a senha.

No PowerShell, com ferramentas PostgreSQL no PATH (ou chamando por caminho absoluto em `C:\Program Files\PostgreSQL\<versão>\bin`), ajustar o nome da base real e o usuário:

```powershell
$env:PGHOST = "localhost"
$env:PGPORT = "5432"
$env:PGUSER = "postgres"
$sourceDb = "zagoquest" # CONFERIR DB_NAME no .env antes
$backup = Join-Path (Get-Location) "zagoquest-backup-$(Get-Date -Format yyyyMMdd-HHmmss).dump"
pg_isready
pg_dump --format=custom --no-owner --file="$backup" --dbname="$sourceDb"
if ($LASTEXITCODE -ne 0) { throw "Backup falhou" }
pg_restore --list "$backup" | Select-Object -First 15
```

O arquivo `.dump` contém dados reais e **não deve ser commitado no GitHub**. Armazenar fora do repositório (se o comando foi rodado dentro dele, mover a cópia imediatamente). A listagem do arquivo comprova que o dump é legível, **não** que foi restaurado com sucesso.

### Restaurar em base separada (não sobrescrever base principal)

Antes, confirmar no pgAdmin que `zagoquest_test` **não existe**; se existir, não executar o `createdb` nem o `pg_restore` por cima. Se não existe:

```powershell
createdb --dbname="postgres" "zagoquest_test"
if ($LASTEXITCODE -ne 0) { throw "Criação da base teste falhou" }
pg_restore --no-owner --no-privileges --exit-on-error --dbname="zagoquest_test" "$backup"
if ($LASTEXITCODE -ne 0) { throw "Restore falhou: não continuar" }
psql --dbname="zagoquest_test" --command='SELECT COUNT(*) FROM characters;'
```

Um backup só será considerado **restaurável** após restore sem erro e consultas de verificação em base separada; se houver erros de ownership/extensão, registrar sem forçar a restauração. Antes de rodar o jogo com a base copiada, editar **somente o .env local**, definindo `DB_NAME=zagoquest_test`, `NODE_ENV=development`, `DB_SYNCHRONIZE=false`, e assegurar que o servidor da base principal esteja desligado. Se o projeto usa senha distinta, configurar localmente sem compartilhá-la.

## 5. Teste mínimo no PostgreSQL local (após PR/CI e backup)

1. Com a base de teste isolada, anotar `id`, `xp`, `level`, `gold`, `bankGold`, `inventory`, `equipment`, `skills`, `posX`, `posY`, `hp`, `mana`.
2. Entrar no Unity, movimentar, ganhar XP/loot e alterar valores pelas interações normais do jogo (não editar SQL).
3. Sair com Ctrl+C, aguardar log de shutdown, reiniciar e comparar todos os valores.
4. Se usar guilda, **não** testar criação/cobrança com personagem online na base principal enquanto o conflito memória/PG estiver aberto.
5. Enviar apenas resultados resumidos e logs sem senha, JWT ou dados privados. Não realizar testes de queda de conexão/desligamento forçado na base principal.

Consulta de comparação **somente leitura** (executar em `zagoquest_test`; substituir nome por nome fictício/teste):

```sql
SELECT id, name, level, xp, "lifetimeXp", "xpVersion", gold, "bankGold",
       "posX", "posY", hp, mana, inventory, equipment, skills
FROM characters
WHERE name = 'PERSONAGEM_TESTE';
```

**Conferir nomes reais de colunas em psql/pgAdmin antes de adaptar a consulta; nomes camelCase TypeORM normalmente exigem aspas.**

## 6. Próximos PRs (não incluídos aqui)

1. Fonte de verdade de wallet/bank/inventário/guilda: escolher contrato único de mutação, transação e atualização do `Player` online; testes integrados contra banco de teste e rollback.
2. Validação segura de dados persistidos, incluindo compatibilidade com saves antigos (não normalizar descartando valores silenciosamente).
3. Migrations TypeORM versionadas e baseline do schema existente **após** inspeção da cópia: não gerar migrations cegas sobre dados reais.
4. CI com serviço PostgreSQL Linux e testes de transação, concorrência/rollback e falhas.
5. Homologação local Unity + PG e checklist do Notion. API REST profunda continua na fase 7.

## 7. Atualização local quando o PR for autorizado/integrado

```powershell
git status
git fetch origin
git switch dev
git pull --ff-only origin dev
cd server
npm ci
npm run build
npm test
npm run dev
```

**Não usar `git reset --hard`, force-push, `typeorm schema:sync` nem migrations em dados reais neste estágio.**
