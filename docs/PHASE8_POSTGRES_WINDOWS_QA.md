# Fase 8 — PostgreSQL local no Windows (pgAdmin 4 e PowerShell)

> Manual de homologação do ZagoQuest. **Use SOMENTE `zagoquest_test` recém-criada e vazia**, nunca a base `zagoquest` com saves. Este roteiro não foi executado no computador do usuário. Não compartilhe senha, JWT, CPF real nem `.env`.

## 0. Pré-requisitos e cuidados

- PostgreSQL local instalado e funcionando; acesso via pgAdmin 4 ou `psql`.
- Node 22/npm, backend atualizado na branch `dev`.
- Feche servidor Node/Unity antes de preparar schema e antes de editar personagens diretamente em SQL.
- O banco `zagoquest_test` deve ser **novo e vazio** (sem tabelas). `db:init:test` recusa um banco que já contém tabelas.
- A migration inicial é **somente baseline de schema novo**. Não migra dados antigos, não deve ser aplicada em `zagoquest`, nem substitui inspeção e plano de migração para saves históricos.
- Nunca executar `npm run test:pg` ou `npm run smoke:dist` localmente: esses são testes potencialmente destrutivos **restritos à CI e `zagoquest_ci`**.

## 1A. Criar database no pgAdmin 4

1. Abra pgAdmin 4, informe senha do servidor PostgreSQL local.
2. Expanda **Servers → PostgreSQL → Databases**.
3. Clique com o botão direito em **Databases → Create → Database...**.
4. Em **Database** digite `zagoquest_test`. Em **Owner**, escolha o mesmo login que o backend vai usar (por exemplo, `postgres`).
5. Salve. Clique com o botão direito em **Databases → Refresh** se não aparecer.
6. Se `zagoquest_test` já existir e contiver tabelas, **não apague**: confira o que há nela e faça backup. Para schema novo, utilize uma base nova/vazia em ambiente separado. O comando seguro não faz DROP.

## 1B. Alternativa via psql no PowerShell

Se o PostgreSQL 16 estiver instalado no local padrão:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h localhost -p 5432 -U postgres -d postgres
```

Ajuste **16** para tua versão instalada. Dentro do `psql` (não é comando PowerShell):

```sql
CREATE DATABASE zagoquest_test;
```

Conectar pelo `psql`:

```text
\c zagoquest_test
```

```sql
SELECT current_database(), current_user, version();
```

Para sair: `\q`.

**pgAdmin Query Tool:** selecione a database `zagoquest_test` na árvore e vá em **Tools → Query Tool**. Ali podes executar `SELECT`, `CREATE`, `UPDATE` SQL, **mas não comandos `\c` ou `\q`** (são comandos específicos do `psql`).

## 2. Configurar backend em `server/.env`

Na raiz do projeto:

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

Se houver alterações locais a preservar, resolva o `git status` antes do pull; **não rode `git reset --hard` para forçar**.

Edite o `.env` **já existente**, sem publicá-lo. Garanta os seguintes valores:

```dotenv
NODE_ENV=development
API_PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=SUA_SENHA_LOCAL_AQUI
DB_NAME=zagoquest_test
DB_SYNCHRONIZE=false
DB_LOGGING=false
WS_AUTH_REQUIRED=true
JWT_SECRET=UMA_CHAVE_LOCAL_LONGA_ALEATORIA_E_PRIVADA
```

Ajuste usuário/senha/porta conforme a tua instalação. **Não cole essas informações reais em chats, issues ou commits**.

## 3. Criar as quatro tabelas pela migration (uma única vez)

**ANTES:** no pgAdmin Query Tool da `zagoquest_test` verifique que está vazia:

```sql
SELECT current_database() AS database_atual;
SELECT tablename FROM pg_catalog.pg_tables
WHERE schemaname = 'public' ORDER BY tablename;
```

A primeira deve ser `zagoquest_test`; a segunda **não deve devolver tabelas de usuário**.

Com o terminal na pasta `server/`, habilite o opt-in **apenas no comando abaixo** (PowerShell):

```powershell
$env:ALLOW_FRESH_TEST_SCHEMA = "true"
try {
    npm run db:init:test
}
finally {
    Remove-Item Env:\ALLOW_FRESH_TEST_SCHEMA -ErrorAction SilentlyContinue
}
```

O comando recusa: produção, bases chamadas `zagoquest`, hosts remotos, `DB_SYNCHRONIZE=true`, ausência de opt-in ou base que já contenha tabelas. Aplica a migration `InitialSchema1793400000000` em transação.

**Esperado:** `[TEST_DB] Schema inicial aplicado na database descartável. DB_SYNCHRONIZE segue false.`

Depois no Query Tool do pgAdmin, ainda na `zagoquest_test`:

```sql
SELECT current_database();
SELECT tablename FROM pg_catalog.pg_tables
WHERE schemaname = 'public' ORDER BY tablename;

SELECT "name", "timestamp" FROM migrations ORDER BY "timestamp";

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('accounts', 'characters', 'guilds', 'guild_members')
ORDER BY table_name, ordinal_position;
```

Deve haver `accounts`, `characters`, `guilds`, `guild_members` e `migrations` (a tabela de histórico do TypeORM). Se `db:init:test` recusar o banco existente, **não** resolva apagando tabelas; confira banco/host e backup antes de qualquer ação.

## 4. Iniciar o servidor e criar duas contas pela API

Terminal A, na pasta `server/`:

```powershell
npm start
```

Aguarde API + WebSocket iniciados, PostgreSQL conectado e mapa Tiled carregado. Se houver falha de conexão, confira serviço PG, porta, senha e DB_NAME (sem publicar senha).

Terminal B — PowerShell, em outra janela:

```powershell
$base = "http://localhost:3000"

$bodyA = @{
  email = "fase8.alfa@example.test"
  cellphone = "+5511999999999"
  fullName = "Conta Teste Alfa"
  cpf = "52998224725"
  birthDate = "1990-01-01"
  password = "senha-teste-fase8-123"
  confirmPassword = "senha-teste-fase8-123"
  address = "Somente testes locais"
}
$bodyB = @{
  email = "fase8.beta@example.test"
  cellphone = "+5511999999998"
  fullName = "Conta Teste Beta"
  cpf = "11144477735"
  birthDate = "1990-01-01"
  password = "senha-teste-fase8-456"
  confirmPassword = "senha-teste-fase8-456"
  address = "Somente testes locais"
}

$accountA = Invoke-RestMethod -Uri "$base/api/accounts" -Method Post -ContentType "application/json" -Body ($bodyA | ConvertTo-Json)
$accountB = Invoke-RestMethod -Uri "$base/api/accounts" -Method Post -ContentType "application/json" -Body ($bodyB | ConvertTo-Json)
$accountA.id
$accountB.id
```

Os CPFs são **exemplos de teste**, não use CPF de pessoa real. Se repetir o teste com as mesmas contas, `409` de cadastro existente é esperado. O limite é **5 cadastros/IP/hora**, não crie dezenas de contas.

### SQL para confirmar contas, sem expor dados sensíveis

```sql
SELECT id, email, "createdAt"
FROM accounts
ORDER BY "createdAt" DESC;
```

**Não faça `SELECT * FROM accounts` e não compartilhe resultados com CPF, endereço ou `passwordHash`.**

## 5. Login com duas contas e personagens próprios

Terminal B (continuar as variáveis em memória do PowerShell):

```powershell
$sessionA = Invoke-RestMethod -Uri "$base/api/sessions" -Method Post -ContentType "application/json" -Body (@{ email=$bodyA.email; password=$bodyA.password } | ConvertTo-Json)
$sessionB = Invoke-RestMethod -Uri "$base/api/sessions" -Method Post -ContentType "application/json" -Body (@{ email=$bodyB.email; password=$bodyB.password } | ConvertTo-Json)
# Não imprima nem copie $sessionA.token e $sessionB.token no chat.
$authA = @{ Authorization = "Bearer $($sessionA.token)" }
$authB = @{ Authorization = "Bearer $($sessionB.token)" }

$charA = Invoke-RestMethod -Uri "$base/api/characters" -Method Post -Headers $authA -ContentType "application/json" -Body (@{ name="Teste Alfa"; gender="M"; world="main" } | ConvertTo-Json)
$charB = Invoke-RestMethod -Uri "$base/api/characters" -Method Post -Headers $authB -ContentType "application/json" -Body (@{ name="Teste Beta"; gender="F"; world="main" } | ConvertTo-Json)

$charsA = Invoke-RestMethod -Uri "$base/api/characters/account/$($sessionA.accountId)" -Headers $authA
$charsB = Invoke-RestMethod -Uri "$base/api/characters/account/$($sessionB.accountId)" -Headers $authB
$charsA | Select-Object id,name,gender,world,level
$charsB | Select-Object id,name,gender,world,level
```

**Esperado:** conta A vê somente `Teste Alfa`, B somente `Teste Beta`.

### Negativos (HTTP 401/403)

```powershell
# Conta B tenta listar os personagens da conta A → 403:
try {
  Invoke-RestMethod -Uri "$base/api/characters/account/$($sessionA.accountId)" -Headers $authB
} catch {
  "HTTP status esperado 403, recebido: $([int]$_.Exception.Response.StatusCode)"
}

# Sem token → 401:
try {
  Invoke-RestMethod -Uri "$base/api/characters/account/$($sessionA.accountId)"
} catch {
  "HTTP status esperado 401, recebido: $([int]$_.Exception.Response.StatusCode)"
}
```

Não compartilhe tokens, senhas ou corpos completos de conta em prints.

### Consultas SQL de personagens

```sql
SELECT c.id, c.name, c."accountId", a.email, c.level, c.gold,
       c."bankGold", c."posX", c."posY"
FROM characters AS c
LEFT JOIN accounts AS a ON a.id = c."accountId"
ORDER BY c."createdAt" DESC;

-- Conferir se existe algum personagem legado sem conta associada:
SELECT COUNT(*) AS personagens_sem_conta
FROM characters
WHERE "accountId" IS NULL;
```

## 6. Guildas: level, gold, custo e proteção

Criação exige level **100** e **20.000 gold**, portanto personagens criados pela API estão level 1 e gold 0.

Para habilitar o teste **somente de forma artificial na `zagoquest_test`**, desconecte os clientes Unity e **pare o servidor no terminal A com Ctrl+C**. Faça backup (se quiser preservar os testes atuais) antes de editar SQL.

No pgAdmin Query Tool **conectado em zagoquest_test**:

```sql
SELECT current_database();
-- Só continue se vier 'zagoquest_test'.
UPDATE characters
SET level = 101, gold = 30000
WHERE name = 'Teste Alfa'
  AND "accountId" = (SELECT id FROM accounts WHERE email = 'fase8.alfa@example.test')
RETURNING id, name, level, gold;
```

**Esperado:** exatamente 1 linha. Não use esse UPDATE na base de saves reais.

Reinicie `npm start`, **sem autenticar o personagem no Unity antes da criação HTTP**, para evitar divergência de gold entre memória e PostgreSQL.

Terminal B — as variáveis de sessão podem continuar válidas por até 24h:

```powershell
$guild = Invoke-RestMethod -Uri "$base/api/guilds" -Method Post -Headers $authA -ContentType "application/json" -Body (@{ characterName="Teste Alfa"; guildName="Guerreiros Teste"; description="Guilda para homologacao" } | ConvertTo-Json)
$guild
```

**Esperado:** HTTP 201, guilda criada, leader `Teste Alfa`, saldo de **10.000 gold**.

### Consultas SQL para guildas

```sql
SELECT id, name, description, level FROM guilds ORDER BY "createdAt" DESC;

SELECT g.name AS guilda, gm."characterName", gm.role, gm.level
FROM guild_members AS gm
JOIN guilds AS g ON g.id = gm."guildId"
ORDER BY g.name, gm.role;

SELECT name, level, gold, "bankGold" FROM characters
WHERE name IN ('Teste Alfa', 'Teste Beta');
```

### Tentativa de outra conta (403)

```powershell
try {
  Invoke-RestMethod -Uri "$base/api/guilds/Guerreiros%20Teste/description" -Method Put -Headers $authB -ContentType "application/json" -Body (@{ characterName="Teste Beta"; description="Alteracao nao autorizada" } | ConvertTo-Json)
} catch {
  "HTTP esperado 403, recebido: $([int]$_.Exception.Response.StatusCode)"
}
```

Confirme via SQL que a descrição não mudou.

## 7. Unity, reconexão e persistência

1. No Inspector do Unity, o `NetworkManager` deve usar `ws://localhost:3000`, com `requireAuthenticatedSession=true`.
2. Use o `SessionLoginDebugUI` para login HTTP + escolha de `characterId` (nunca envie nome de personagem como substituto do UUID na autenticação WS).
3. Autentique `Teste Alfa` na sessão A e `Teste Beta` na sessão B. Abra um Editor e um build, ou duas instâncias de build, conforme teu ambiente. Certifique-se de usar duas contas diferentes.
4. Confirme movimento, colisão, snapshot, combate, inventário, NPC, gold, guilda, reconexão e mensagens entre clientes. Na UI ainda ausente (por exemplo, pesca), registre `SEM UI` e valide apenas o comportamento do servidor que for observável.
5. Pare o servidor com Ctrl+C, confirme `[SHUTDOWN] Finalizado` e reinicie. Volte ao pgAdmin e confira `posX`, `posY`, XP, gold, inventário e demais dados de personagem.
6. Não execute testes destrutivos de rollback SQL no banco local; a CI já cobre trigger/rollback com um PostgreSQL descartável.

SQL de inspeção (somente consulta):

```sql
SELECT name, level, xp, "lifetimeXp", "xpVersion", hp, mana,
       gold, "bankGold", "posX", "posY", inventory, equipment, skills
FROM characters
WHERE name IN ('Teste Alfa', 'Teste Beta');

SELECT name, "updatedAt" FROM characters ORDER BY "updatedAt" DESC;
```

## 8. Backup da base de TESTE e problemas mais comuns

No Windows (PostgreSQL 16 de exemplo):

```powershell
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -h localhost -p 5432 -U postgres -Fc -f "$HOME\Documents\zagoquest_test_backup.dump" zagoquest_test
```

O backup deve ficar fora do repositório e nunca em commit. Para comprovar que é restaurável, faça uma restauração em **outra** database vazia, sem sobrescrever `zagoquest_test`.

| Sintoma | Verificação sem destruir dados |
| --- | --- |
| `ECONNREFUSED` | PostgreSQL está ativo, `localhost:5432`, usuário e senha do `.env` |
| `relation "accounts" does not exist` | Migration não aplicada ou `DB_NAME` incorreto; verifique Query Tool e `migrations` |
| `db:init:test` recusa porque há tabelas | **Proteção funcionando.** Verifique se o banco realmente é novo/vazio; não apague tabelas |
| `409` ao criar conta/personagem | Dados já cadastrados; use novos dados fictícios ou faça consulta |
| `429` em cadastro/login | Limite por IP; respeite janela (`Retry-After`), não desative proteção para forçar teste |
| `401` no Unity | JWT ausente/inválido/expirado, flags WS divergentes ou Character de outra Account |
| `403` em acesso cruzado | **Resultado esperado** para conta B tentando controlar dados de A |
| `Guild precisa de level/gold` | Só edite personagens artificiais enquanto servidor/par de clientes estiver desligado |
| `git pull` bloqueado | Conferir `git status`/`git diff`, não descartar alterações importantes |

### Evidências a enviar para análise

Informe somente `PASSOU/FALHOU`, prints do Console sem JWT, e saídas SQL sem dados sensíveis. Modelo:

```text
F8-01: servidor iniciado e Ctrl+C finalizado?
F8-02/03: A e B criadas/logadas, negativos 401/403?
F8-04: personagens próprios listados, IDs distintos?
F8-09: guilda de Alfa, gold 30000→10000, edição de Beta proibida?
F8-05 a F8-12: Unity com dois personagens, reconexão, combate, save/restart?
DB: somente zagoquest_test, DB_SYNCHRONIZE=false, migration instalada?
```

**Tarefas manuais de 5.2, 6.2, 7.2 e 8.2 permanecem abertas até o usuário registrar resultados.**
