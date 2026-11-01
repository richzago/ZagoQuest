# ZagoQuest — UI 2B · Área dinâmica de Mochila e Loot

**Branch isolada:** `feature/client-ui-sidebar-dynamic-loot-backpack-2b`, criada a partir de `dev` no commit `913bd4920297b2c7a991a4fa6dcecf780a24c9d4`. A UI 2A foi homologada no Unity pelo usuário. **Não integrar a UI 2B sem novo teste visual e autorização expressa.**

## Escopo entregue

A área inferior `DynamicContentSection` da sidebar C8 passou de placeholder a **host funcional** com abas `MOCHILA` e `LOOT`, botão × para fechar o cadáver e `RectMask2D` para conteúdo não invadir outras seções.

- **Mochila:** reutiliza o `InventoryPanel` real da `scenebasic.unity`, que continua operado por `InventoryUI` e seus `InventorySlot` originais. O painel passa a ocupar `SidebarDynamicHost`. A aba **MOCHILA** abre o inventário; a tecla **I** ainda alterna abrir/fechar. O grid usa duas colunas de tamanho responsivo, scroll vertical do C6 e rótulo de ouro em mãos. Uso de consumíveis, duplo clique, equipamentos e drag/drop seguem no mesmo handler de antes.
- **Loot:** reutiliza a `LootPanel` real (root com `LootUI`, `PanelVisual`, `ScrollRect`, `Content`, `LootItemSlot` e botões `TakeAllButton`). Ao clicar um corpse, a resposta `lootWindow` do Node abre **automaticamente** a aba LOOT. Uma linha ou `Take All` continuam enviando `SendTakeLoot`, com índice do snapshot e trava `awaitingServer`. O botão × da nova aba chama o mesmo `CloseLootWindow()`, sem mensagem nova.
- **Abas exclusivas:** só uma área visual fica ativa por vez (via `CanvasGroup.alpha` e `blocksRaycasts`), evitando que janelas se cubram ou "cliques fantasmas" sejam disparados. Ao fechar loot, volta para a Mochila se estiver aberta; caso contrário a seção fica vazia, com abas visíveis.
- **Reutilização, não duplicação:** a classe `C8SidebarDynamicDock` só encaixa objetos existentes, após `InventoryUI.Start` criar o scroll/grid e `LootUI.Start` criar `C6DragHeader`. Não existe segundo `LootUI`, `InventoryUI`, nem prefab ou container de itens novo. Em `Undock`, os dois objetos retornam a seus parents originais **antes do Canvas da sidebar ser destruído**.
- **Identidade visual:** os títulos arrastáveis, botões antigos de fechar e a ajuda redundante desaparecem no dock. A sidebar continua minimalista (tons `#121B27`, `#1D2938`, acento `#AF8B50`); as abas são clicáveis apenas na área visível. Os cards minimapa, equipamento e ícones, bem como o recorte de Main Camera já homologado, não mudam.

## Limite funcional — mochilas de verdade no backend

No código atual, `InventoryUI` recebe **um inventário único** por snapshot (`InventoryHandler`). O slot `EquipmentSlot.BACKPACK` existe, mas o servidor ainda não implementa múltiplas backpacks independentes com IDs, capacidade, nested containers e persistência individual. A aba `MOCHILA` nesta PR é **a visualização do inventário atual**, e não um sistema novo de containers. Implementar backpacks separadas exige outra fase de contratos/Node/saves; não simular essa funcionalidade no cliente sem servidor autoritativo.

## Engenharia de segurança e riscos controlados

1. **Hit testing:** `C8SidebarCanvas` continua sem Graphic fullscreen; `SidebarSurface` captura somente o espaço visível da coluna. `RectMask2D` corta filas/grids excedentes. `CanvasGroup.blocksRaycasts` só é true no painel de aba selecionada, mantendo fora da sidebar o clique do mundo. `TargetSelector.cs`, `IsPointerOverUi` e `C8PlayfieldViewport.cs` **inalterados**.
2. **Linha de loot:** ao atualizar o snapshot, linhas antigas são desativadas **antes** do `Destroy` adiado da Unity. A nova linha preserva `OnItemClicked(index)` e `OnLootTaken`, sem assumir ACK do Node. A tipografia fica menor no dock, sem trocar callbacks.
3. **Inventário:** grid 2 colunas, célula dimensionada ao espaço do host; o `C6InventoryViewport` mantém `ScrollRect` e `C6InventoryDropTarget`; ouro fica no rodapé. O dock não envia comandos de gameplay.
4. **Layout/ordem de criação:** aguarda o `C6InventoryViewport` e o `C6DragHeader` antes de mover qualquer painel. Não recria Canvas, Camera, mapa ou loot; não executa Start de outro componente manualmente.
5. **Resoluções:** DynamicHost é responsive e pode ficar baixo com F10 em 130% a 1280×720; listas internas têm rolagem e precisam de **homologação real** para legibilidade/click. O resizing manual vertical é etapa futura, não está neste PR.
6. **Lifetime:** os painéis de cena são retornados ao parent anterior ao destruir a sidebar; scripts permanecem nas instâncias originais.

## Arquivos modificados

- **Novo:** `Client/Assets/Resources/Scripts/UI/C8SidebarDynamicDock.cs` e `.meta`.
- `Client/Assets/Resources/Scripts/UI/C8SidebarShell.cs`: expõe `DynamicSection`, oculta hint e chama `Undock` no destrutor.
- `Client/Assets/Resources/Scripts/Networking/NetworkManager.cs`: bootstrap único do dock.
- `Client/Assets/Resources/Scripts/UI/InventoryUI.cs`: `OpenInventory`, consulta de visibilidade e notificações de abrir/fechar.
- `Client/Assets/Resources/Scripts/UI/LootUI.cs`: `IsLootOpen`, notificações de abre/fecha, modo dockado e desativação imediata de linhas antigas.
- `Client/Assets/Resources/Scripts/UI/LootItemSlot.cs`: tipografia compacta, sem alterar índices/ações.
- `server/tests/clientC8DynamicDockContracts.test.ts`: guardas de segurança e identidade de cena.
- Este documento e o roadmap.

## Checklist de homologação Unity antes de merge

- [ ] Play Mode compila C# sem errors/exceptions. Sidebar, minimapa redondo e equipamentos continuam idênticos ao aprovado.
- [ ] Clicar aba **MOCHILA** abre inventário existente, duas colunas, ouro em mãos, e **I** fecha/abre normalmente.
- [ ] Drag/drop Inventário→Equipamento, Equipamento→Inventário, drop no mundo (fora da UI) seguem funcionando; testar nomes longos e quantidades.
- [ ] Clicar corpse na área jogável abre **automaticamente** aba LOOT com várias linhas clicáveis e scroll (testar 3–10 itens).
- [ ] Pegar **segundo/terceiro item** por clique único remove apenas o escolhido; índices se atualizam após ACK; teste de clique repetido não duplica ações.
- [ ] **Take All** remove tudo após confirmação do Node; close **×** fecha sem exigir confirmação; loot vazio não quebra.
- [ ] Abrir mochila, depois corpse: troca para LOOT sem perder inventário; ao fechar loot, volta à MOCHILA se ainda aberta.
- [ ] Quando LOOT está fechado, sua aba fica desabilitada; nenhum painel transparente bloqueia cliques da sidebar ou do mundo.
- [ ] Confirmar mouse/clicabilidade fora da sidebar: primeiro clique monstro START, segundo clique STOP; NPC, pickup, corpse e pesca tecla R não regrediram.
- [ ] Ver mapa/água à direita, sem mapa duplicado, com viewport que continua acompanhando o player; zoom +/−.
- [ ] Testar 1920×1080 e 1280×720, F10 100/115/130: aba, lista e botões continuam legíveis, nenhuma sobreposição ou "vazamento" do item para outros cards.
- [ ] Logout/login/reconexão não duplica painéis, não mantém janela invisível bloqueando e não altera inventário no servidor.
- [ ] **NÃO MERGEAR** antes de testes reais e sinal verde explícito do usuário.

**CI Node Windows/Linux/PostgreSQL valida testes estáticos de UI e contratos de servidor, mas não compila Unity C# e não renderiza a cena.**
