# C5 — NPC/World: auditoria técnica, contratos e roteiro de homologação

**Iniciada:** 31/10/2026 · **Status:** INVENTÁRIO E MATRIZ INICIAL CONCLUÍDOS; investigação/QA específicos C5 em andamento. **Sem correções de gameplay C5 aplicadas nesta entrega.**

## 1. Pré-requisito e metodologia

A fase **C4 — Player/Combat está concluída/homologada** após **10/10 cenários [OK]** informados pelo desenvolvedor no Unity Editor Alfa + build Windows Beta (incluindo respawn, combate, troca de alvo, fuga/retomada do Goblin e três reentradas em Play Mode sem exceções). PRs [#94](https://github.com/richzago/ZagoQuest/pull/94) e [#96](https://github.com/richzago/ZagoQuest/pull/96) já integrados na `dev`; [CI pós-merge #96](https://github.com/richzago/ZagoQuest/actions/runs/41223282123) PASS Windows/Linux/PostgreSQL. C0/C1/C3 concluídas; C2 funcionalmente aceita. **Não reabrir C4 por suspeita sem reprodução.**

**Método C5:** Entender → Identificar → Priorizar → Corrigir somente bug confirmado → Testar → Documentar → Integrar. Cada correção deve ter seu PR pequeno, contrato Unity↔Node, testes automatizados e QA local. Não antecipar C6 (polimento/inventário/UI), C7 (pesca visual) ou C8 (E2E). `main` preservada.

## 2. Inventário real da dev e fronteiras

| Subsistema | Autoridade Node | Unity/Interface | Objetivo C5 |
| --- | --- | --- | --- |
| Spawns NPC Tiled | `mapLoader`, `NpcLoader`, `NpcAI` | `EntityManager`, `NpcIdentity`, `SpawnHandler` | Banker e Merchant com IDs de instância únicos, coords corretas e sprites/colisão |
| Clique e interação | `NpcInteractionSystem`, `shop.handler`, `bank.handler` | `ClickInteract`, `TargetSelector`, `ShopSender`, `BankSender` | Apenas clicar NPC válido e próximo, uma sessão econômica autorizada por jogador |
| Conversação e IA | `NpcAI`, `NpcInteractionSystem`, `chatCommands`, `move.handler` | `ChatUI`, `MoveHandler`, `ClickInteract` | Conversa interrompida ao sair do alcance, NPC volta a andar; sem travamento |
| Loja | `ShopSystem`, `shop.handler` | `ShopUI`, `ShopItemSlot` | Catálogo/estoque/preço/saldo definidos pelo Node; compras inválidas não concedem itens |
| Banco | `BankingSystem`, `bank.handler` | `BankUI` | Depósito/saque validam sessão, quantidades, saldo e limites; nenhum gold criado |
| Criaturas e IA | `MonsterAI`, `MonsterLoader`, `DeathSystem` | `MonsterIdentity`, `MonsterHealthBar`, `EntityManager` | Aggro, wander, chase, flee e respawn sem duplicação/corner-cut |
| Cadáver e loot | `LootSystem`, `DeathSystem`, `loot.handler` | `CorpseIdentity`, `LootUI`, `LootItemSlot`, `LootWindowHandler` | Um cadáver por morte, alcance/itens/capacidade validados, conteúdo não duplicado |
| Multicliente | `World`, `NpcInteractionSystem`, WebSocket broadcast | Editor Alfa + executável Beta | NPC ocupado não troca de interlocutor sem validação; estado correto nas duas telas |

## 3. Evidências positivas da primeira leitura (não confundir com QA C5)

1. **Spawns já corrigidos em C1:** Banker originalmente `(25,13)`, Merchant `(25,5)`, Goblin `(4,5)` no mapa atual; a IA pode deslocá-los depois do bootstrap. `NpcLoader` verifica mapa/ocupação, lê JSON por `npcId`, identifica a instância por `templateId@tiled:objectId` e dá prioridade a atributos do Tiled em `radius`, `interactionRadius`, `moveCooldown`.
2. **Servidor autoritativo na economia:** `NpcInteractionSystem.canInteract` exige HP > 0, NPC presente no mundo, tipo banker/merchant correspondente e distância Manhattan <= 2. O `open` invalida autorização econômica anterior; `getActive` revalida ao comprar/depositar/sacar; `invalidateIfOutOfRange` é executado após movimento aceito no `move.handler`. O `closeIfActive` protege contra close atrasado de outra janela.
3. **Banco não confia num npcId do cliente no depósito:** `deposit` e `withdraw` usam a sessão de Banker aberta no Node, não a escolha do cliente. `BankUI` exibe o resultado recebido, sem creditar gold localmente.
4. **Loja não confia em preço informado pelo Unity:** catálogo/preço saem do NPC/servidor; `handleBuyItem` consulta novamente interação ativa e `ShopSystem.buyItem`. Uma solicitação sem janela válida é recusada.
5. **IA NPC:** `NpcAI` interrompe andar durante `isTalking`, verifica jogador ainda presente, distância e cooldown, e evita movimento diagonal cortando canto/ocupação.
6. **Loot:** `DeathSystem` cria um `Corpse` para morte processada uma vez; `loot.handler` exige corpse existente e distância Manhattan <= 2, valida `itemIndex`, capacidade e quantidades antes de transferir; broadcasts de despawn após remoção. C4 confirmou cadáver único e loot básico, **não** toda a matriz de inventário/itens C5/C6.

## 4. Riscos/questões a verificar antes de qualquer novo código

| Ref | Tipo | Hipótese a reproduzir | Prioridade proposta |
| --- | --- | --- | --- |
| C5-R01 | **RISCO**, não bug comprovado | `NpcInteractionSystem` autoriza a <= 2 tiles, enquanto `NpcAI.interactionRadius` pode ser 3 (configuração Tiled/JSON). Testar limite 2→3→4: conversa pode permanecer visualmente ativa mesmo que transação já esteja negada. Diferentes raios podem ser deliberados, portanto **não unificar automaticamente**. | P2 se reproduzir inconsistência |
| C5-R02 | **RISCO**, não bug comprovado | Ao caminhar para longe, o Node revoga a sessão econômica, mas o painel Unity pode continuar aberto até o usuário fechar. Verificar que qualquer compra/saque é recusado, e decidir separadamente se a UX precisa fechar painel (possível C6). | P1 se autorizar operação distante; P2 se apenas visual |
| C5-R03 | **RISCO**, não bug comprovado | Alfa tenta abrir Merchant/Banker enquanto Beta conversa com o mesmo NPC; servidor usa `isTalking` e `talkingToPlayerId`. Garantir que Beta não seja substituído e que logout/movimento liberem NPC sem bloqueio permanente. | P1 se permissão indevida |
| C5-R04 | **REGRESSÃO POTENCIAL** | Aggro/chase/flee de Goblin em obstáculos, limites de wander e retorno ao spawn; C4 validou fuga/retomada com um Goblin, mas não todas as condições ambientais. | P2 |
| C5-R05 | **RISCO**, não bug comprovado | Tomar um item do meio do corpse muda o `itemIndex` dos itens seguintes. Verificar se `LootUI` atualiza/fecha corretamente com `lootTaken` e corpse mutado; só corrigir com reprodução. | P2 funcional; C6 para UX |
| C5-R06 | **HISTÓRICO DE UX** | O desenvolvedor já relatou que a janela Loot mostra/select apenas o primeiro item em alguns casos. Não reclassificar isso como bug do `LootSystem` sem provar o contrato entre `LootUI`, prefab e layout/scroll; o polimento visual pertence à C6. | P2, roteiro C6 |
| C5-R07 | **RISCO**, não bug comprovado | Dois clientes tomam loot do mesmo corpo; cada ação deve serializar/validar corpo e impedir item duplicado, observando respostas `lootError`, `lootTaken`, `inventory` e `despawn`. | P1 se duplicação |
| C5-R08 | **DÍVIDA TÉCNICA / revisão futura** | Catálogos, logs e estados de erro de Merchant/Banker devem continuar coerentes após reconexão e reabertura; não refatorar `Network` nem introduzir novo protocolo sem falha. | P3 até evidência |

**Fora do escopo C5:** redesenho da janela Loot e inventário geral (C6), pesca visual ainda não implementada (C7), soak/load e release E2E (C8). O servidor permanece responsável por regras econômicas e de mundo, não Unity.

## 5. Matriz de testes automatizados existente

- `server/tests/npcTiledConfig.test.ts`: NPCs instanciados pelo Tiled, configuração de IA.
- `server/tests/npcInteractionLifecycle.test.ts`: sessão de conversa/interação, exclusividade, saída.
- `server/tests/economyInteractions.test.ts`: autorização econômica de banco/loja, sessão e validação.
- `server/tests/aiReturnToSpawn.test.ts`, `aiDiagonalCorners.test.ts`: retorno ao spawn, colisões, corner-cut.
- `server/tests/monsterSpawns.test.ts`, `monsterRegistry.test.ts`: criaturas e registros.
- `server/tests/worldSnapshotCorpses.test.ts`: cadáver e snapshot do mundo.
- `server/tests/unityNpcInteractionContracts.test.ts`, `unityBankUiContracts.test.ts`: contratos C# estáticos (não são testes de Unity Play Mode).
- `server/tests/sharedMonsterXp.test.ts`, `combatEvents.test.ts`: recompensa/XP e eventos da morte.

**Status desta entrega:** listados e inspecionados os pontos de entrada; a suíte C5 não foi modificada neste PR documental. A CI do PR de documentação pode executar a suíte atual, mas não comprova por si só cenários Unity/2 jogadores ainda não testados para C5.

## 6. Roteiro prático para homologação C5 (próxima bateria com usuário)

1. **Setup:** utilizar `dev`, Node e Unity atualizados; duas contas Alfa Editor e Beta build Windows. Observar logs sem JWT ou senha. Não alterar banco/mundo real só para testar cenários destrutivos.
2. **Spawns e IA:** verificar que Banker, Merchant e Goblin iniciam nas células Tiled corretas; NPC anda dentro do raio, não entra na água, para durante interação e retoma após /bye/afastamento; Goblin age sem ultrapassar limites.
3. **Interações:** Alfa perto de Merchant clica e abre loja; clicar longe recusa. Beta tenta conversar com mesmo NPC enquanto Alfa está usando a loja; aguardar reação; sair/fechar e confirmar liberação.
4. **Merchant:** abrir catálogo, comprar quantidades válidas e inválidas, saldo insuficiente, preço/estoque; confirmar que inventário/gold mudam só após resposta Node. Comprar após caminhar >2 tiles deve falhar.
5. **Banker:** abrir banco ao lado, depositar/sacar valores válidos, zero, negativo, saldo insuficiente e valor extremo; somente operação autorizada muda `gold/bankGold`. Caminhar para longe e tentar transação: deve ser negada.
6. **Cadáver e loot:** matar Goblin, abrir corpse dentro do raio, tentar fora do raio; tomar item individual de diferentes índices e takeAll; confirmar índice/capacidade, inventário e despawn do corpse. Repetir em Alfa/Beta evitando coleta dupla.
7. **Sessões:** desconectar durante loja/banco/conversa e reconectar; o NPC volta a ficar disponível; nenhuma autorização econômica antiga deve persistir.
8. **Registro:** trazer console Unity e logs Node para erros reais, identidades relevantes e comportamento esperado/observado. Após testes, classificar cada falha real e corrigir incrementalmente em PR com teste de regressão e QA; não declarar C5 fechada antecipadamente.

## 7. Critério de saída de C5

- NPCs/monstros carregam, andam e interagem respeitando regras Tiled/World.
- Duas contas não obtêm controle/compra/operação concorrente não autorizada sobre NPC ocupado.
- Loja e banco respeitam interação autorizada, distância, saldo, quantidade e estado de sessão.
- Cadáver/loot sem duplicação, com transferências válidas e mensagens em ambos os clientes.
- Bugs reproduzidos corrigidos com testes Node + Unity, CI verde, docs/Notion sincronizados.
- **C5 só será homologada após aceite explícito do desenvolvedor.** C6 e C8 permanecem independentes.
