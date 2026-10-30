# ZagoQuest — checklist de validação e próximas correções

Esta lista é parte da [Auditoria viva do servidor](https://app.notion.com/p/409ec07d7c4f8158ae8cf46c4b10ac2c) e acompanha os PRs [#1–#23](https://github.com/richzago/ZagoQuest/pulls). Marcar **implementado na branch** não equivale a **validado em produção**.

## Fase 1 — Preparar ambiente de revisão (Windows 11)

- [ ] Fazer backup do PostgreSQL, do `.env` local e dos dados de desenvolvimento.
- [ ] Revisar os PRs empilhados na ordem #1 → #22, seus diffs e riscos; conferir se a base de cada PR aponta para o anterior.
- [ ] Baixar a branch mais recente **sem fazer merge**:
  ```powershell
  git fetch origin
  git switch --track origin/fix/backend-world-factory-error-boundaries
  cd server
  npm ci
  npm run build
  npm test
  ```
- [ ] Confirmar CI verde no SHA final do PR #23, sem confundir runs antigos de commits anteriores.
- [ ] Configurar `server/.env` local: `NODE_ENV=development`, `DB_SYNCHRONIZE=true` **somente local**, credenciais PostgreSQL e segredo JWT forte.
- [ ] Executar `npm run dev`; validar bootstrap, erro de porta ocupada, Ctrl+C, autosave final e fechamento dos sockets sem exceção.
- [ ] Testar `npm run build && npm start` a partir da pasta `server`, confirmando que os assets necessários continuam disponíveis.

## Fase 2 — Segurança REST + transações PostgreSQL reais

- [ ] Conta A cria/lista seus personagens com JWT A; requisições para conta B devem resultar em 403, sem alteração de dados.
- [ ] Criar guilda somente com personagem pertencente à conta JWT; impedir alteração de uma guilda informada indevidamente na URL.
- [ ] Com personagem nível 100+ e 20.000+ gold, criar guilda e confirmar **uma** cobrança de 20.000, guilda e líder criados juntos.
- [ ] Provocar falha real na criação do líder ou violação de constraint; **nenhuma** cobrança parcial deve persistir.
- [ ] Disparar duas criações concorrentes do mesmo personagem; no máximo uma compra e nenhum saldo negativo.
- [ ] Verificar se uma alteração de gold via REST pode ser perdida pelo autosave do Player em memória. **Bloqueador conhecido de produção**.
- [ ] Validar autenticação de sessão, CORS, limites de requisição, erro sanitizado e rate limit de login.

## Fase 3 — Gameplay, rede e Unity

- [ ] Matar um monstro com ataque normal: um evento de dano, um corpse, XP correta e um respawn no prazo.
- [ ] Matar monstro por veneno/burn: XP atribuída ao aplicador, um cadáver e nenhum evento repetido; testar sobrekill.
- [ ] Matar um player por condição: penalidade, respawn, stats sincronizados e DoT encerrado.
- [ ] Abrir banco/loja perto e longe, comprar/vender/depositar/sacar; tentar montantes negativos e excessivos.
- [ ] Testar drop/pickup/loot com inventário cheio, itens empilhados e reenvio de comando.
- [ ] Reconectar durante a existência de cadáver e item no chão; snapshot inicial deve exibir ambos uma vez.
- [ ] Movimentar com WASD/diagonais; validar que teleporte, passos repetidos em excesso e mensagens inválidas são rejeitados.
- [ ] Desconectar enquanto um handler assíncrono executa; o shutdown não pode iniciar save final antes de concluir esse handler.
- [ ] Validar propriedades de NPC no Tiled: radius, interactionRadius e moveCooldown, incluindo valores inválidos e defaults.
- [ ] Executar Play Mode e build do Unity; comparar `Messages`, `Senders` e `Handlers` em cada mudança de protocolo.

## Fase 4 — Correções de arquitetura ainda abertas

- [ ] **P0:** criar login WebSocket JWT + seleção de `characterId`, verificar propriedade e expiração; não usar `world.players[0]` para jogo público.
- [ ] **P0:** unificar a fonte de verdade da economia REST/World/PG antes de permitir compras/operar guilda online.
- [ ] **P1:** desenhar migrations TypeORM versionadas, testar num clone do PostgreSQL, com rollback e dados legados.
- [ ] **P1:** salvar/carregar todos os players autenticados, evitando perda ou duplicação em reconexões e operações paralelas.
- [ ] **P1:** validar JSONB de inventário, equipamentos, skills, XP, gold e posição antes da aplicação ao runtime.
- [x] Isolar falhas de MapLoader versus Monster/NpcLoader — implementado no PR #23, ainda sem merge.
- [ ] **P1:** validar estrutura do Tiled JSON e falta de layer Collision com dados reais; testar políticas de fallback.
- [ ] **P1:** resolver caminhos de dados/assets para rodar `dist` sem depender incidentalmente do diretório `src`.
- [ ] **P2:** controlar duração de condições e ticks com clock determinístico e testes, eliminando discrepâncias setInterval/game loop.
- [ ] **P2:** planejar timeout de shutdown e recuperação segura de tarefas bloqueadas.
- [ ] **P2:** analisar performance com centenas de monstros, carga WS e métricas de game tick (p95/p99); só depois considerar índice espacial.
- [ ] **Opcional:** extrair responsabilidades de Player/MonsterAI/World gradualmente, apenas se testes demonstrarem ganho de manutenção.
- [ ] **Futuro:** spell system, pathfinding A*, party, houses e escalabilidade para múltiplos mundos.

## Fase 5 — Critério de conclusão para cada PR

- [ ] Bug reproduzido por teste que falha na versão anterior.
- [ ] Mudança limitada a uma responsabilidade; evitar abstrações genéricas e comentários que repetem o código.
- [ ] Build TypeScript e suíte automatizada aprovados no SHA final.
- [ ] Testes com PostgreSQL real se envolver schema, transação ou persistência.
- [ ] Smoke test Unity se envolver payload, spawn, combate, sessão ou movimento.
- [ ] Documentação com arquivos-chave, contrato, riscos, testes e link do PR.
- [ ] Fazer merge somente após revisão humana dos PRs dependentes na ordem correta.
- [ ] Atualizar o Notion: classificar implementado/CI verde, validado localmente, mesclado e pronto para produção separadamente.

**Importante:** esta lista não declara o servidor pronto para acesso público. A autorização WS, integridade estado-em-memória/DB, migrations e validação end-to-end são bloqueios reais.
