# Integração preservadora dos PRs #29–#57 na `dev`

Data: 31/10/2026. Área: World/Lifecycle, Unity, Gameplay e primeira etapa de persistência.

## Objetivo e regra de preservação

- Integrar o conteúdo das **29 PRs** #29–#57 sem apagar alterações de outras branches.
- Código consolidado: árvore validada pela QA [#57](https://github.com/richzago/ZagoQuest/pull/57), commit `b45140d17688913aa99ec4b1b25b474b547adf23`.
- A QA #57 é descendente das QAs #46 e #33; seu conteúdo recebeu as correções de gameplay/Unity e o autosave multiplayer, preservando o timer de guilda no bootstrap.
- As 26 PRs de correção/testes restantes foram incorporadas como **ancestrais de commits de merge que mantêm a árvore de arquivos validada pela QA**. Isto é uma resolução deliberada de mudanças sobrepostas, não 26 reaplicações cegas sobre o código; evita sobrescrever correções posteriores. Seus commits originais continuam alcançáveis no histórico Git.
- Todos os 77 caminhos alterados pelas PRs constavam no diff da QA #57; isso verifica cobertura de arquivos, mas a aceitação funcional depende também dos testes e do usuário.
- Base original da `dev`: `a280d803106e7f0bf9b00f8bca907c759332bae2`.
- Branch de recuperação **imutável por este procedimento**: `backup/dev-before-pr29-57-20261031`.
- Branch de preparação: `integration/pr29-57-20261031`.
- `main` não faz parte da integração.

## PRs incluídas

| Intervalo / PR | Assuntos |
|---|---|
| #29–#32 | Scheduler, IA, identidade NPC, colisões diagonais |
| #33 | QA integrada da Fase 2 (preservada como ancestral da QA final) |
| #34–#40 | Unity loot, morte/posição, interação NPC, reconnect, snapshots, banca/loja |
| #41–#45 | Pesca, skills, condições, autoattack e bait |
| #46 | QA integrada da Fase 3 (ancestral da #57) |
| #47–#55 | Testes de gameplay, perseguição, velocidade, XP compartilhada, respawn Tiled, posição, STOP/target |
| #56 | Fase 4 — autosave multiplayer, regressões e documentação |
| #57 | QA final com as fases 3 e 4 |

## Testes e cuidados

- CI anterior #57: [run #41154847811](https://github.com/richzago/ZagoQuest/actions/runs/41154847811), 343/343 testes em Linux e Windows.
- O commit **integrado** exige CI própria no PR de integração (build e testes Linux/Windows). Não confundir com o commit da QA.
- Nenhuma migration, alteração de `.env` ou mudança direta no PostgreSQL nesta integração.
- Limites conhecidos: divergência memória/PG para gold alterado por REST/guilda, JSONB legado sem validação completa, falta de migrations versionadas, segurança multiplayer a revisar (fases 4 e 5).

## Atualização segura no Windows

Na raiz do repositório local:

```powershell
git status
git branch backup/local-before-pr29-57
git fetch origin
git switch dev
git pull --ff-only origin dev
git log -1 --oneline
cd server
npm ci
npm run build
npm test
npm run dev
```

**Antes do `git switch` e do `pull`:** se `git status` apresentar mudanças locais, fazer commit em branch própria ou guardar `git stash push -u -m "backup antes integracao PR29-57"`; não usar `reset --hard`, `clean -fd` nem forçar pull. Para Unity, deixar o editor fechado durante a atualização. Manter backup do banco e do `server/.env`; não colocar credenciais em commit.

Se houver divergência no `pull --ff-only`, parar e conferir commits locais, sem forçar. A branch `backup/dev-before-pr29-57-20261031` permite comparar e recuperar o estado remoto anterior.

## Pós-integração

- Confirmar que `origin/dev` tem como ancestrais todas as PR heads #29–#57 e que `main` não foi alterada.
- Conferir UI GitHub: as PRs podem ser reconhecidas automaticamente como merged após avanço da base; se não, registrar integração por histórico de merge e **não apagar as branches originais**.
- Rodar smoke tests Unity + PG no Windows (posição, autoattack/target após fuga, loot, XP, gold, autosave, shutdown).
- Resolver o risco de saldo em memória versus PostgreSQL **em PR separado**, antes de concluir a fase 4.
