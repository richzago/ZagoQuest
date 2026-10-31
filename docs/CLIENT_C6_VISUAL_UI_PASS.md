# C6 — Primeira passagem visual: inventário e equipamentos

**Branch:** feat/client-c6-inventory-equipment-visual
**Estado:** revisão em PR Draft; Unity QA pendente.

## Evidências encontradas na cena dev após o PR #100

- CanvasScaler usa resolução de referência 1920×1080.
- InventoryPanel está em 500×300, ancorado à esquerda; SlotsGrid tem 6 colunas de 80px e ContentSizeFitter horizontal PreferredSize; prefab InventorySlot mede 42×19px com fontes 6–8.
- EquipmentPanel está aninhado em TopRight (400×300), mede 200×300, e os slots são 30×30. Há itemIcon não atribuído na cena.
- A baseline #100 corrigiu lifecycle, drag/equipItem e snapshots, mas ainda não fez redesign.

## Mudanças

1. Inventário (360×500) e equipamentos (276×500) posicionados lado a lado no alto à direita. EquipmentPanel é reparentado ao Canvas apenas em runtime para não ficar preso ao TopRight; a cena serializada é preservada.
2. Grade de inventário de 3 colunas com células 92×92, ScrollRect e RectMask2D, cabeçalho, fechamento, ouro rotulado e dica de controles.
3. InventorySlot passa a mostrar o nome uma vez na base, quantidade xN no canto, sprite opcional e fallback legível; ClickArea sem listener deixa de interceptar raycast.
4. Equipamentos ganham disposição corporal com células 70×70; o texto identifica slot vazio e item equipado na falta de ícone. Texture2D por snapshot foi removido.
5. Arrastar equipamento para a região vazia do viewport do inventário também solicita unequip, inclusive quando não existem itens.
6. Sem alterações Node, PostgreSQL, Tiled, combate, mapas ou main. Toda transferência continua validada pelo Node.

## Checklist de QA (Unity Editor 6000.4.10f1 + Windows)

- [ ] Scripts C# compilam sem erro; Console sem MissingReferenceException.
- [ ] Editor Alfa e build Beta em 1280×720 e 1920×1080: painéis legíveis, sem bloquear chat/HUD/loja/banco/loot.
- [ ] I abre, chat digitando i não abre, X fecha, I reabre, 3 reloads Play Mode.
- [ ] Inventário vazio, 1, 10, 30 tipos: scroll funcional e último item clicável, quantidade correta e ouro vindo do Node.
- [ ] Equipar por duplo clique/drag; slot inválido é recusado sem apagar item no cliente.
- [ ] Desequipar soltando sobre outro slot e viewport vazio; verificar capacidade e confirmação via snapshot.
- [ ] Arrastar sobre UI não cria item no chão; drop real envia uma intenção.
- [ ] Regressão C5: loot 3/8 itens, segundo/terceiro selecionáveis, TakeAll, Banker com rótulos e Merchant sem estoque.

**Limite de CI:** testes TS inspecionam contratos estáticos, mas não compilam C# e não renderizam Canvas. C6 só pode ser homologada após QA local. Próxima passagem: PlayerHUD/gameplay/chat.