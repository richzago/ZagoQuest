# C16 — Backpack e Loot redimensionáveis, scroll preciso e quatro slots

**Base:** C15 [#121](https://github.com/richzago/ZagoQuest/pull/121) mergeada na `dev` em `6c80da4` por autorização expressa do usuário. **Branch:** `feature/c16-resizable-inventory-loot-scroll`. **PR:** [#122 DRAFT](https://github.com/richzago/ZagoQuest/pull/122). Não integrar C16 antes de homologação/autorizar.

## Motivo da correção

O layout C15 reduzia a mochila a **112 px**, mostrando somente uma linha de dois itens apesar da Bag poder ter muitos slots. A configuração da rolagem também reiniciava o Loot no topo quando uma linha era removida, enquanto dispositivos com `scrollDelta.y=120` podiam causar saltos grandes no `ScrollRect`.

## Implementação

1. **Quatro slots padrão:** `C8SidebarDynamicDock.AdaptInventoryGrid` usa duas colunas, células de 50 px, 3 px de espaçamento e Bag com altura mínima de 170 px. `InventoryUI.CreateEmptySlotVisuals` preenche células visuais vazias até `bagSlots - slotsUsed`, sem inventar itens, arrastes ou alterar o contrato Node. Se a Bag tiver menos de quatro slots de capacidade, a UI não cria capacidade fictícia.
2. **Roda fina:** `C16FineScrollWheel` intercepta `IScrollHandler` no viewport recortado e no trilho da barra. Normaliza `scrollDelta.y` para -1..1 e move **até 18px/evento**, um pouco de cada linha. Impede pular vários itens com `scrollDelta=120`. A scrollbar vertical nativa permanece clicável e arrastável.
3. **Viewport adequado:** no C6, `scroll.viewport` apontava para o próprio `ScrollRect`; agora a C16 cria `C16ClippedViewport` filho com `RectMask2D` e imagem transparente raycastable, sem encolher o elemento raiz. Conteúdo é movido para dentro dele; faixa da barra recebe 14px.
4. **Redimensionamento Tibia-like:** `C16PanelResizeHandle` adiciona uma barra inferior explícita `PUXE PARA AJUSTAR` em Backpack e Loot. Movimento é convertido para coordenadas locais do host, respeitando escala F10. Arrastar para baixo aumenta o painel; para cima diminui, até 170px Bag/150px Loot. Limite superior = altura total dos slots/linhas ou espaço livre na coluna. Preferências de altura separadas em `PlayerPrefs`. Nunca altera largura, nem ocupa espaço de HUD de equipamentos ou outros painéis.
5. **Painéis adjacentes:** se Bag e Loot estiverem na mesma coluna, o sistema reserva `MinLootHeight` e espaço de 6px quando comporta ambos. Se a coluna for curta (720p/F10 alto), prioriza a aba selecionada em altura funcional, em vez de cortar os dois painéis. Em colunas separadas, alturas independentes.
6. **Loot sem saltos de snapshot:** `LootUI.RebuildRows` reinicia a posição vertical apenas ao mudar de cadáver; remover uma linha não retorna a rolagem ao topo. Botão TODOS foi reposicionado acima da borda de resize. O layout de linhas do Loot reduz o espaçamento vertical de 8 para 3 px e padding de 16 para 8 px, preservando os índices reais do servidor.

**Segurança:** alterações somente em UI/UX do cliente Unity; servidor continua autoritário para slot/capacidade, pesos, transferência Bag↔Bag e autorização de loot.

## Checklist Unity C16

- [ ] **Quatro células visíveis** ao equipar Simple Bag em 1280×720 (100%) e 1920×1080; Bag cheia e Bag vazia exibem a grade sem cortar linhas.
- [ ] **Roda do mouse** sobre os itens, área vazia e trilho da barra: mover gradualmente e alcançar todos os itens, sem pular.
- [ ] **Puxador de scrollbar** deve ser clicável e arrastável lentamente até a última linha sem esconder a primeira; confirmar após receber snapshot de loot retirado.
- [ ] **Puxador inferior de Backpack**: arrastar para baixo até limite da capacidade de slots; subir para altura de quatro slots; arrastar repetidamente sem deslizar para fora da tela; reiniciar cliente e validar altura preferida.
- [ ] **Puxador inferior do Loot**: aumentar até conteúdo/altura do host, diminuir, e verificar TODOS e clique nos itens.
- [ ] **Convivência de janelas:** Backpack+Loot na mesma coluna e em colunas separadas, 1280×720/1920×1080 e F10 100/115/130; a janela selecionada e o mapa permanecem clicáveis.
- [ ] **Bag filha:** transferir itens com Bags cheias e verificar recusa sem perda; UUID/ciclos devem ser confirmados nos testes Node, pois a UI normal não permite enviar UUID forjado.
- [ ] **Regressão:** NPC, pesca, autoloot Shift+L 3×3, CAP, logout, drops e inventário em combate.

## Evidências e limitações

- `server/tests/clientC16ResizableContainers.test.ts` acrescenta 6 testes de contratos estáticos do cliente; atualiza testes C8/C9 e o script npm. Estes **não compilam C#** nem comprovam Play Mode: somente o usuário pode verificar o layout no Unity local.
- A integração C15 foi autorizada com QA parcial 6/8; C16 busca encerrar a lacuna de interface relatada. O controle de ciclos do servidor continua separado do gesto na interface, não se deve tratar impossibilidade de forjar UUID pela UI como falha de segurança.
- Persistência de chão + save de personagem ainda não é transação SQL conjunta sob crash abrupto, risco previamente documentado na C15.

**Governança:** PR #122 permanece **Open/Draft** até aprovação explícita para merge.
