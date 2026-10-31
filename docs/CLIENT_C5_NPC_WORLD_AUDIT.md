# C5 — NPC/World: auditoria técnica, contratos e roteiro de homologação

**Iniciada:** 31/10/2026 · **Status:** C5 EM ANDAMENTO; auditoria de NPC/World iniciada e correção funcional/visual de Loot, Merchant e Banker preparada em PR incremental. **QA Unity pendente: não declarar UI corrigida ou C5 homologada antes do aceite.** O Node continua autoritativo; nenhuma regra econômica alterada neste PR.

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

## 8. Ampliação aprovada pelo desenvolvedor — interfaces NPC e cadáver/loot na C5

O desenvolvedor solicitou expressamente incluir **o layout visual de Merchant, Banker e a interação de cadáver/loot ainda na C5**, porque os problemas já impedem clicar nos itens a partir do segundo. **C6** tratará o layout e a usabilidade de **Inventário, Equipamentos e HUD/gameplay** com outra bateria específica. A autoria do layout será por **C# em runtime**, preservando os objetos e referências serializadas da cena, sem exigir intervenção manual em cada RectTransform da Hierarchy.

### 8.1. Bugs reais confirmados na cena e nos scripts atuais

**C5-P1/P2 — Loot com linhas colapsadas e cliques interceptados.** A `scenebasic.unity` referencia `LootPanel`, `ItemContainer`, `Viewport` e `Content`. O `Viewport` do loot tinha `m_AnchorMin={0,0}`, `m_AnchorMax={0,0}`, `m_SizeDelta={0,0}`, tornando sua área de visualização efetiva nula. O `Content` tinha `VerticalLayoutGroup.childControlWidth=0` e `childControlHeight=0`, logo os filhos do prefab retinham seu layout fixo ao serem empilhados. `LootItemSlot.prefab` tinha os dois textos TMP com `m_RaycastTarget=1`, interceptando cliques no componente `IPointerClickHandler` da raiz. A coleta exigia `clickCount == 2`. O botão de fechar existe em `LootPanel/Button`, mas o campo `closeButton` no `LootUI` está serializado como `fileID: 0` (não atribuído). A raiz `LootPanel` também tem `Image.raycastTarget=1` mesmo transparente. **Resultado: janela desalinhada, área clicável reduzida, cliques no mundo bloqueados e seleção extremamente difícil.**

**C5-P2 — Loot parcial fechava a janela por qualquer confirmação.** O `LootTakenHandler` atual chamava `CloseLootWindow()` sem examinar `itemIndex`. O Node envia `lootTaken {corpseId,itemIndex}` para coleta individual e omite o índice no `takeAll`. Portanto, a janela era descartada após pegar apenas um item, exigindo reabri-la e tornando confuso o deslocamento dos índices. O `LootErrorHandler` ignorava erros totalmente, sem liberar o estado visual.

**C5-P2 — Merchant com prefab desproporcional e lista sem controle de altura.** O prefab `ShopItemSlot_Temp.prefab` tinha um root de **400×300** e seus campos de nome/preço/estoque/input/botão em coordenadas absolutas; o `ShopPanel` utiliza uma lista cujo `VerticalLayoutGroup` também serializa `childControlHeight=0`. Isso distorce linhas, causa sobreposição e cliques em botões errados. `ShopUI.OnDestroy` estava vazio e sua duplicata inicializava após Destroy, podendo manter singleton obsoleto. A quantidade visual do prefab existia, mas `ShopItemSlot` ignorava seu TMP_InputField e enviava sempre compra de 1.

**C5-P2 — Banker desalinhado por coordenadas absolutas.** No `BankPanel` de 400×300, `BankGoldText`, `GoldText`, input e botões tinham RectTransforms com posições fora da área ou excessivamente afastadas. Essa correção é **cosmética + responsiva**, não modifica validações de depósito/saque.

### 8.2. Implementação da interface na branch C5

| Arquivo | Mudança |
| --- | --- |
| `UI/WorldWindowLayout.cs` + `.meta` | Helper compartilhado: painel com paleta escura, `VerticalLayoutGroup` controlando largura/altura, `ContentSizeFitter` por altura preferida, ScrollRect vertical, rows com `LayoutElement`, colunas por âncoras, labels sem bloquear raycast, botões com estilo uniforme |
| `UI/LootUI.cs` | Reposicionar painel/ItemContainer/Viewport, desabilitar raycast da raiz transparente, recuperar botão Close da Hierarchy e o botão TakeAll, lista de linhas 56 px; coleta apenas com conexão válida e uma solicitação pendente; manter lista aberta após retirada individual e recomputar índices conforme ACK |
| `UI/LootItemSlot.cs` | Toda linha clicável por **um clique esquerdo**; TMP labels sem raycast; nome e quantidade em colunas responsivas |
| `Networking/Handlers/LootTakenHandler.cs` | Interpretar `corpseId` e `itemIndex` e chamar `LootUI.OnLootTaken` em vez de fechar tudo |
| `Networking/Handlers/LootErrorHandler.cs` | Propagar erro do Node, liberar botão e informar no chat |
| `UI/ShopUI.cs` | Layout de lista, viewport, scroll vertical, slots de 76 px; lifecycle de singleton, listener de fechar estável e referência Network atual |
| `NPC/ShopItemSlot.cs` | Nome/preço/estoque/input/comprar alinhados por âncoras; ler quantidade inteira positiva do campo se presente; verificar estoque local para feedback e **delegar compra ao Node** (que revalida tudo) |
| `UI/BankUI.cs` | Painel centralizado, saldos e input alinhados, botões comprar/depositar/sacar/fechar com tema consistente; lógica de saldos permanece somente via resposta Node |
| `server/tests/clientC5NpcLootUiContracts.test.ts` | Contratos de layout/scroll/raycast, clique único, `lootTaken` parcial, recusa de erro, quantidade e preservação da autorização econômica; adicionado a `npm test` |

**Proteção de multiplayer e economia:** `LootUI` só remove o item exibido **após** receber `lootTaken`; o cliente não presume item/gold disponível. O backend continua validando distância, itemIndex, quantidade, capacidade, estoque e saldos; nenhum handler Node foi alterado neste PR. Durante uma coleta em voo, cliques adicionais ficam temporariamente bloqueados para não enviar dois índices concorrentes. Se um ACK chegar de outro corpse, ignorá-lo. `lootError` libera a tentativa e mostra mensagem. A lista pode ser reaberta para receber snapshot autoritativo se outro jogador tiver mudado o cadáver.

### 8.3. Limites da entrega, classificação e riscos

- **Correções comprovadas de layout/contrato:** Viewport nulo, VerticalLayoutGroup sem controle de altura, textos TMP bloqueando clique, duplo clique difícil, closeButton sem referência, lootTaken parcial fechado sempre, prefab shop com root 300px e campo quantidade ignorado.
- **Pontos que ainda exigem Unity:** ordem efetiva dos elementos na UI com o `ZagoQuestUiTheme` ativo, máscara/scroll com 1/3/8 itens, resoluções 1280×720/1920×1080, painel aberto após afastar-se de NPC, dois clientes coletando o mesmo cadáver.
- **Futuro C6:** redesign de inventário, equipamentos e HUD/gameplay; não alterar código dessas áreas na C5. Se a UI de loja e banco precisar de novos ícones/sprites/arte, isso é polimento adicional, distinto do bloqueio funcional C5.
- **Não declarar C5 encerrada só pela CI:** testes de C# são estáticos. Exigir execução de Play Mode e build Windows, com evidência de funcionamento.

### 8.4. Checklist adicional de homologação C5 — UI/UX

1. Abrir cadáver com **3 ou mais itens diferentes**. Confirmar que todas as linhas estão visíveis, **nenhum texto ocupa a área de outra linha**, o primeiro/segundo/terceiro item respondem a **um clique**; itens 4–8 permitem scroll vertical com mouse. O painel fica dentro da tela e pode ser fechado no X.
2. Clicar no **segundo item**: somente ele deve ser adicionado ao inventário após ACK; o painel mantém os demais itens, com índices reajustados e botão TakeAll funcionando. Repetir até zerar. Reabrir e confirmar item não duplicado. Testar clicar duas vezes rapidamente: não duplica coleta.
3. Com corpo vazio, distante, removido ou inventário sem espaço: servidor recusa; erro aparece no ChatUI, botão volta a funcionar e gold/itens não são criados. Não forçar drop artificial na conta principal.
4. Abrir Merchant: todas as linhas têm nome/preço/estoque/quantidade/botão alinhados; scroll da lista; comprar 1 e quantidade maior, inválida e acima do estoque; observar `buyResult` e mudanças somente após Node confirmar.
5. Abrir Banker: saldos, quantidade, depósito, saque e fechar ficam dentro do painel; testar quantidade válida/zero/saldo insuficiente/fora do alcance, sem discrepância de gold. Abrir/fechar repetidamente sem botões duplicados.
6. Alternar loja/banco/loot com Alfa e Beta, testar NPC ocupado, afastamento, desconexão e reconexão. Nenhuma UI deve permitir operação econômica depois que o Node revoga a sessão.
7. Repetir Play Mode e build Windows. Console sem `MissingReferenceException`, `NullReferenceException` ou `RectTransform`/LayoutGroup warnings, sem painéis fora do viewport.
8. Enviar screenshots de Inspector/Hierarchy somente se houver falha de configuração ainda não coberta por runtime; assim podemos corrigir o prefab/scene depois com evidência, sem reintroduzir mudanças manuais na C1/C4.

**Critério de aceite específico para encerramento C5:** servidor e Unity passam testes de NPC/Monster, autorização de shop/bank/loot, concorrência e layout/seleção funcional de itens múltiplos, com resultados localmente aprovados pelo desenvolvedor. C6 será a etapa de inventário/equipamentos/HUD.
