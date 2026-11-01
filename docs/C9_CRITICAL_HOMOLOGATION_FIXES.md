# ZagoQuest — C9, revisão pós-homologação: drop, pickup, NPC e loot compacto

> **C10 atualizado (01/11/2026):** a arquitetura C9 de inventário único foi substituída por **Bags com instâncias/UUID e conteúdo persistente próprio**, Merchant requer Bag para poções e Take All usa **Shift+E**. A sidebar agora é configurável via engrenagem (colunas 0–3 esquerda e 1–3 direita) e tem dimensões menores. As descrições e atalhos C9 abaixo são históricos: **a especificação vigente é [C10_INDIVIDUAL_BAGS_CLIENT_SETTINGS.md](C10_INDIVIDUAL_BAGS_CLIENT_SETTINGS.md)**. PR #119 continua em Draft, sem merge.


**Situação:** correções implementadas na própria branch `feature/server-authoritative-containers-loot-c9`, PR #119 **aberto em Draft, base `dev`, sem merge**. O usuário reportou bugs após testar Bag/Backpack (incluindo logs de spawn de item no chão). Validar no Unity Play Mode antes de integrar.

## Diagnóstico baseado nos logs

1. **Bootstrap impossível de Bag no chão — bug real (P0).** `handlePickupItem` exigia `player.canCollectItems`, que falha se `getContainerCapacity() === 0`. Isso rejeitava precisamente a primeira Bag largada no chão. O log `SpawnHandler: Instanciado` só confirma renderização do objeto, **não confirma pickup**. Agora o Node admite recuperar **uma** Simple Bag/Backpack de fato definida no ItemRegistry, sem outra equipada, fazendo autoequip + `sendEquipment` + `sendInventory`. Não aceita esse caminho para consumíveis, moedas, item fake, quantidade maior que 1 ou fora de alcance.
2. **Drop de equipado removia cópia errada — bug real (P0).** Antes, o Node preferia `player.inventory.has(itemId)`; se o mesmo item estivesse equipado e na Bag, poderia derrubar uma unidade do inventário e deixar a bolsa equipada. Novo `fromEquipment` booleano serializado pelo Unity `DragDropManager.IsFromEquipment()`, validado no Zod e no Node. Para `true`, verifica slot equipado, quantidade exatamente 1, remove-o diretamente e recalcula atributos; para `false`, remove só inventário; se omitido, preserva fallback para cliente legado sem ambiguidade. **Nunca repetir drop para completar um drop legítimo.**
3. **Texto do item bloqueia NPC/cliques — bug real (P1).** `ItemNameManager.ShowItemName` desabilita `raycastTarget` para TextMeshProUGUI e Graphics filhos. `TargetSelector.FindWorldClickCollider` dá precedência ao NPC sobre item no chão **somente em sobreposição com ground item**, não interferindo na seleção de monstro ou cadáver.
4. **Arrastar Bag do chão até o slot BACKPACK — funcionalidade exigida (P1).** `TargetSelector` guarda ID + posição no mouse-down do item, processa no mouse-up e envia **um** pickup para clique comum ou drag solto no `EquipmentSlot.BACKPACK`; arrastar para outro painel ou fora do mundo cancela. O servidor continua validando distância, objeto e inventário. A primeira Bag recuperada é autoequipada.
5. **Drag de loot do cadáver até tile do chão — funcionalidade exigida (P1).** Novo comando `dropCorpseLoot` (índice, corpseId, tile X/Y), registrado em `handlers/index.ts` e `messageValidation.ts`, gerado pelo `LootItemSlot.OnEndDrag` **somente fora de qualquer Canvas**. Servidor valida cadáver presente, alcance Manhattan ≤2 do corpo e do destino, bounds e índice; remove **uma linha** da lista do cadáver e cria **um item no chão**; envia `lootTaken` para atualizar UI. Não depende de Bag e não altera inventário/gold. O drag da linha para Bag continua usando `takeLoot` individual e não emite `dropCorpseLoot`.
6. **Bag/Loot enormes e rolagem exagerada — UX (P1).** No `C8SidebarDynamicDock`, Bag limitada a ~142px, Loot a ~176px, salvo ajuste proporcional quando área dinâmica menor; grid 2 colunas com linhas de **62px**, espaçamento 4×3 e ícones 34×34; lista Loot com linhas de **36px**, tipografia autoajustável. `ScrollRect.scrollSensitivity` 9–10, `inertia=false`, movimento Clamped. `scrollRect` do Loot aproveita espaço antes reservado para botão Take All (agora Ctrl+Shift+L). Em altura inferior a 245px, mostra uma área por vez para preservar a seleção.
7. **Muitos corpses abertos — UX/LRU (P2).** `LootUI` mantém até `MaxTrackedCorpses=4` IDs na lista de navegação local. Ao abrir um novo, remove o mais antigo da seleção e torna o novo ativo. Setas < e > pedem snapshot novo ao servidor e não fingem itens antigos. **Evicção local não deleta loot, cadáver nem item do mundo.** Cada cadáver permanece validado no Node e pode voltar a ser aberto clicando nele.
8. **Regressão de testes antigos (CI).** Contratos C4/C5/C6 antes exigiam pickup no mouse-down, linha de 56px e assinatura antiga `SendDropItem`; atualizados para o comportamento C9, sem afrouxar a autoridade do servidor. Contratos Zod/handler agora cobrem **24** comandos incluindo `dropCorpseLoot`. Testes de economia adicionam casos duplicados/atomicidade.

## Arquivos mais afetados

- `server/src/network/handlers/inventory.handler.ts`, `loot.handler.ts`, `messages/client/inventory.messages.ts`, `messages/index.ts`, `handlers/index.ts`, `validation/messageValidation.ts`.
- `Client/Assets/Resources/Scripts/Managers/DragDropManager.cs`, `ItemNameManager.cs`; `Combat/TargetSelector.cs`; `UI/EquipmentSlotUI.cs` permanece usando `DragDropManager`; `UI/LootUI.cs`, `UI/LootItemSlot.cs`, `UI/C8SidebarDynamicDock.cs`, `Player/InventorySlot.cs`; `Networking/Senders/InventorySender.cs` e `Networking/Messages/Outgoing/OutgoingMessages.cs`.
- `server/tests/economy.test.ts`, `clientC9InteractionPolish.test.ts`, `clientC4PlayerCombatContracts.test.ts`, `clientC5NpcLootUiContracts.test.ts`, `clientC6InventoryEquipmentContracts.test.ts`, `networkContracts.test.ts` e `networkValidation.test.ts`.

## Limitadores assumidos

- **Uma Bag/Backpack ativa por personagem; inventário global preservado.** Múltiplos recipientes individuais e conteúdos persistentes distintos ainda não estão modelados no banco. `containerSlots` 10/20 continua definido em cada item JSON, e coleta de chão/loot é validada por capacidade. Os saves antigos não são apagados mesmo quando contêm itens acima do limite; compra/loja ainda não é uma transferência transacional para slots de Bags distintas. Não mascarar este ponto com uma grade fictícia.
- **Uma lista de Loot selecionada por vez** com navegação entre até quatro cadáveres recentes (não quatro ScrollRects lado a lado). O limite evita esconder a interface. O Node é a fonte de verdade de cada conteúdo.
- **C# não é compilado na CI Node/PG**; checar console e layout no Unity para aprovar. O PR #119 continua em Draft.

## Checklist de homologação — obrigatória antes de merge

- [ ] Reproduzir drop da **Simple Bag** equipada: um drag do slot BACKPACK ao chão cria **um** item; slot é limpo após snapshot (não repetir 3 vezes).
- [ ] Com segunda Bag igual no inventário, dropar a equipada não diminui a cópia armazenada e não duplica o item.
- [ ] Sem Bag equipada, clicar a Bag caída **uma vez** recolhe e autoequipa (o chão desaparece); repetir pickup não duplica.
- [ ] Sem Bag equipada, arrastar Bag caída para slot BACKPACK autoequipa; arrastar para outro slot/canvas não coleta.
- [ ] Sem Bag equipada, clicar moeda/poção no chão **não coleta** e dá feedback de erro. Distância >2 não coleta.
- [ ] Clicar NPC por cima de item caído abre diálogo; clicar item sem NPC coleta; primeiro clique em monstro START, segundo STOP; cadáver abre Loot. Rótulos TextMeshPro de item não bloqueiam.
- [ ] Clicar um item de loot coleta para Bag (Node ACK); arrastar linha do cadáver para Bag também coleta UMA vez, sem ground spawn.
- [ ] Arrastar linha do cadáver para tile próximo fora da UI move do **cadáver para o chão** sem alterar inventário; não repetir/spawn duplicado; arrastar para longe falha sem perder loot.
- [ ] 3–10 linhas no loot: selecionar 2ª/3ª linha, conferir remoção/ACK e scroll; linhas 36px, conteúdo rolável e tipografia legível.
- [ ] 10+ itens na Simple Bag: rolar lentamente, enxergar últimas linhas, sem avançar duas linhas por notch; rodapé mostra `Slots: X/10`.
- [ ] Bag aberta e loot abertos juntos: Bag ~142px, Loot ~176px em 1920×1080; em 1280×720/F10 100/115/130, não sobrepor minimapa/equipamentos.
- [ ] Abrir 5 cadáveres perto do jogador: seletor contém últimos 4; voltar a corpse antigo clicando nele; nenhum loot desaparece do mundo.
- [ ] Ctrl+Shift+L pega tudo se couber; se exceder capacidade, falha SEM perda parcial. Antigo botão Take All não invade painel.
- [ ] Sair no Acesso Rápido continua funcional; logout/relogin não duplica UI nem perde equipamentos, itens ou gold.
- [ ] Água à direita/viewport/follow/zoom permanecem intactos; NPC banking/shop, pesca e autoattack sem regressão.
- [ ] Console Unity sem erros C#; realizar o teste do servidor Node com banco e confirmar logs/erros `[SERVER LOG]`.

**Não integrar na `dev` antes de aprovação explícita do usuário.**
