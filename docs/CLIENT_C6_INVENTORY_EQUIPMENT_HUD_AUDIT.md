# ZagoQuest — C6: Inventory / Equipment / HUD, auditoria funcional e visual

**Início:** 31/10/2026 · **Estado:** C6 IMPLEMENTADA EM ETAPAS na dev (#100, #101, #102); CI Node PASS 463/463 Windows/Linux e PostgreSQL no #102. A fase NÃO está homologada: falta QA visual/funcional da Unity Editor + build Windows.

## 1. Handoff e escopo da fase

C3 (Network/Auth) e C4 (Player/Combat) estão concluídas com aceite local. A C5 (NPC/World e UI de Merchant/Banker/Loot) recebeu aceitação positiva do desenvolvedor após o PR #98, e o PR [#99](https://github.com/richzago/ZagoQuest/pull/99) integrado na `dev` (commit `281d73060fe05b9e5398e8fbdf10d3abb4408639`) esclarece os saldos do Banker e elimina estoque finito na autoridade do Node. **Os dois refinamentos finais da C5 requerem teste local rápido, mas não impedem o início da auditoria C6 em branch separada.**

**Objetivo C6:** inventário funcional e legível, interação com equipamento coerente, slots bem organizados, ouro e barras do HUD, estados de interação/conexão, drag/drop, atalhos e responsividade. **Não modificar o servidor autoritativo sem bug real comprovado.** Manter `main` intacta e PRs pequenos para facilitar testes.

## 2. Arquivos e contratos encontrados na dev

| Camada | Arquivos relevantes | Responsabilidade |
| --- | --- | --- |
| Unity inventário | `InventoryUI.cs`, `InventorySlot.cs`, `Prefabs/InventorySlot.prefab`, `InventoryHandler.cs` | Grade, quantidade/nome, menu, item use/equip/drop |
| Unity equipamento | `EquipmentUI.cs`, `EquipmentSlotUI.cs`, `EquipmentHandler.cs` | Mapear slots, mostrar snapshot autoritativo, equip/unequip/drag |
| Unity estado de arraste | `DragDropManager.cs` | Ciclo drag, origem/destino, enviar intenção de equip/unequip/drop |
| Unity HUD | `PlayerHUD.cs`, `PlayerStatsHandler.cs`, `ZagoQuestUiTheme.cs` | Barras HP/mana/XP, posição, FPS e nome |
| Hierarchy/layout | `Client/Assets/scenebasic.unity`, `CanvasScaler`, prefabs de slot e painéis | Âncoras, GridLayoutGroup, máscara, raycast, interação |
| Autoridade | `inventory.handler.ts`, `player.ts`, `InventorySender` | Validar posse, item, slot, quantidade, posição/collision, gold; responder snapshots |

## 3. Achados da baseline — não confundir bug com design

### BUG P2 — InputAction "I" com callback não removido

`InventoryUI.Awake` criava `new InputAction` e registrava `performed += ctx => { ... ToggleInventory(); }`, mas `OnDestroy` tentava remover **outra** lambda `performed -= ctx => ToggleInventory()`, que não é a mesma instância de delegate. `Instance` também permanecia após destruir a cena e o Awake da duplicata não retornava. Risco de callbacks obsoletos, `MissingReferenceException` e inventário que abre fora de contexto em reload. Corrigir com `OnToggleInventory(InputAction.CallbackContext)` nomeado, guardas de null em OnEnable/OnDisable e cleanup do singleton. Bloquear tecla I em TMP_InputField, incluindo filhos de campos (chat).

### BUG funcional P1/P2 — arrastar item para slot de equipamento não envia equipItem

`EquipmentSlotUI.OnDrop` validava `draggedItemId` e logo chamava `DragDropManager.EndDrag()`, sem `SendEquipItem` ou `DropOnEquipmentSlot`. `InventorySlot.OnEndDrag` também terminava o drag se o raycast atingia diretamente `EquipmentSlotUI`, sem comando. Resultado por inspeção: arrastar item para equipamento podia não equipar nada. Corrigir com `DragDropManager.DropOnEquipmentSlot(slotType)` somente para origem de inventário, sessão ativa; deixar Node validar tipo/slot/propriedade; garantir que `OnEndDrag` após `OnDrop` não dispare `dropItem` no mundo.

### BUG P2 — Equipamento desatualizado após unequip e ciclo de vida

`EquipmentUI.OnEquipmentUpdate` percorria somente entradas do snapshot; slots omitidos (vazios) **não eram limpos** e podiam continuar mostrando o item anterior após `unequip`. `EquipmentUI.OnDestroy` era vazio e o `Awake` da duplicata não retornava. Corrigir iterando todos os `slotMap` e usando `equipment.TryGetValue`, com `SetItem(null)` para ausência. Garantir `slotsContainer` configurado. `EquipmentSlotUI.Start` não deve chamar `ClearItem` sobre item já recebido da rede antes de Start.

### Riscos de visual/arquitetura ainda sem homologação

- **R01/UI:** `InventorySlot` atualmente exibe nomes longos até no texto de quantidade, não carrega ícones reais e pode estourar as dimensões do prefab. Precisa ver grade/prefab, não inventar dimensões sem referência.
- **R02/asset:** `EquipmentSlotUI` cria um `Texture2D` 64x64 e `Sprite.Create` para cada fallback sem cache/destroy. Pode causar uso de memória desnecessário em atualizações repetidas. Investigar assets carregados e reduzir alocações em PR de visual, após QA.
- **R03/interaction:** `EquipmentSlotUI` contém "SubscribeToNetworkEvents" com flag `isSubscribed` mas sem inscrição real. O `EquipmentHandler` alimenta `EquipmentUI` diretamente; a flag é dívida técnica de nomenclatura, não reescrever Network sem bug.
- **R04/loop:** `InventoryUI.RefreshUI` destrói todos os slots e os reinstancia ao receber `inventory`; mudanças rápidas podem ocasionar GC, hover perdido ou múltiplos objetos transitórios. Medir no Unity antes de adotar pooling.
- **R05/responsividade:** layout atual de inventário/equipamento/HUD provavelmente usa RectTransforms fixos; auditar `scenebasic.unity`, prefab `InventorySlot`, `CanvasScaler`, ancoragem e event raycast em 1280x720 e 1920x1080. Não copiar o layout de loot automaticamente: inventário usa grade, não lista.

## 4. Primeiro PR da C6 — baseline funcional e lifecycle

Branch `fix/client-c6-inventory-equipment-baseline`:
- `InventoryUI`: delegate do atalho I nomeado e removido corretamente, singleton limpo, proteção se InventoryPanel indisponível, conexão consultada para equipar com duplo clique, proteção contra disparar hotkey digitando em campo TMP.
- `EquipmentUI`: singleton correto, guard de SlotsContainer, snapshots limpam slots ausentes, toggle null-safe.
- `InventorySlot` e `EquipmentSlotUI`: drop sobre UI não vira item dropado no mundo; origem inventário para equipamento envia `equipItem` uma vez via `DragDropManager`, sem alterar posição/quantidade diretamente no cliente; guardas de conexão. `EquipmentSlotUI` não limpa item válido recebido antes de Start.
- `server/tests/clientC6InventoryEquipmentContracts.test.ts`: teste de contratos estáticos C# + emissão de mensagens e referência à autorização Node. Adicionado ao `npm test`.

**Limite dos testes:** CI Node/Linux/Windows/PostgreSQL não compila Unity C#, não executa drags no EventSystem nem renderiza Canvas. O primeiro PR só deve ser mesclado com CI verde; **C6 permanece EM ANDAMENTO** até testes e reforma visual completa.

## 5. Roteiro de QA da primeira entrega C6

1. Abrir inventário com `I`, digitar `i` no chat sem abrir/fechar painel; fechar/reabrir e reiniciar Play Mode 3 vezes sem `MissingReferenceException`.
2. Receber itens do servidor após login e após compra/loot; confirmar quantidades e gold corretos, sem itens duplicados localmente.
3. Duplo clique num item equipável: Node valida e responde com novo equipment/inventory; item deve aparecer no slot apropriado. Item não equipável deve ser recusado sem sumir.
4. Arrastar item do inventário ao slot correspondente de equipamento: deve equipar; arrastar para slot incompatível deve ser recusado pelo Node, sem perda do item.
5. Arrastar item equipado para inventário: enviar unequip, atualizar inventário e **limpar o slot** no próximo snapshot. Testar também com inventário em condição de capacidade limite.
6. Arrastar sobre botões/outros painéis: **não** enviar drop no chão. Dropar deliberadamente em tile permitido deve criar item no mundo uma única vez; em água/distância inválida deve ser recusado.
7. Testar 1280×720 e 1920×1080, Editor Alfa e build Beta; registrar erros de Console/Node e screenshots de desalinhamento para PR de redesign.

## 6. Plano visual da C6 (próximas entregas)

Proposta a ser refinada após inspeção/prints:
- **Inventário:** grade de slots quadrados consistentes com ícone central, quantidade discreta, estados vazio/ocupado/hover/selecionado, painel de ouro rotulado, rolagem quando lotar.
- **Equipamentos:** layout por posições corporais sem sobreposições, slots identificados, fallback gráfico reutilizável, botão/gesto claro de equip/unequip.
- **HUD:** contraste e hierarquia HP/mana/XP, nível, nome, gold e feedback; sem mudar valores enviados por PlayerStatsSender.
- **Input/multiplayer:** atalhos não interferem no chat, foco, drags, trocas rápidas e reconnect; nenhuma decisão de autoridade transferida para Unity.

**Critério de conclusão C6:** inventário e equipamentos funcionais (equip/unequip/use/drop sem duplicação), HUD fiel aos dados Node, UI organizada/legível e responsiva, testes CI + QA explícito do desenvolvedor. Não antecipar C7/C8.


## 7. Auditoria cruzada C6: sete UIs e autoridade — 31/10/2026

O desenvolvedor reportou funcionamento aparentemente correto das interfaces depois de #101. Esse relato é aceite funcional preliminar, não substitui QA detalhado de HUD/chat/concorrência.

| Componente | Revisão do código | Verificação restante |
| --- | --- | --- |
| InventoryUI | Gold e itens vêm dos handlers; botão e atalhos enviam intenção | Pilhas, double-click, múltiplos itens, UI com chat focado |
| EquipmentUI | Snapshot limpa slots ausentes; nunca cria item | Equip/unequip, slot errado, inventário cheio |
| LootUI | Espera ACK lootTaken; erros reabilitam interação; índice e corpseId conferidos | 1/3/8 itens, scroll, disputa Alfa/Beta, ACK tardio |
| ShopUI | Compra via sender; catálogo e saldo vêm do Node | Quantidade zero/grande, cliques rápidos, Merchant ilimitado |
| BankUI | Banco/carteira só por bankWindow/bankResult; lock de cliques até ACK | Saque/depósito concorrente e erro, reabrir após desconexão |
| PlayerHUD | Exibe PlayerStatsData; XP total distinto de progresso; clamp só visual | Nível, morte, cura, reconnect, duas resoluções |
| ChatUI | Submit TMP + botão; Update apenas abre input; canais são prefixos enviados ao Node | Envio único, foco mouse, Enter/numpad, permissões e desconexão |

**Bug real do chat corrigido nesta branch:** Enter podia enviar via Update e onSubmit simultaneamente, além de reabrir chat no mesmo frame. A correção centraliza envio, protege frame, usa callbacks nomeados e removíveis, acompanha onSelect/onDeselect, mostra erro offline sem perder rascunho, limita o histórico a 160 mensagens e desativa interpretação RichText. Node permanece autoridade dos canais/comandos.

**HUD:** agrupamento visual dos componentes de TopCenter/PlayerBars em runtime sem editar a cena. Barras não interativas e normalizadas só para apresentação; XP cumulativo e progresso distintos; média de FPS a cada 0,5 s. Não alterar dano, posição, XP, velocidade ou atributos do jogo.

**Banco:** um único depósito/saque pendente por janela. Botões desabilitados até bankResult e liberados também em erro/fechamento. Não aplicar saldo local nem reenviar automaticamente após timeout (para evitar operação duplicada sem idempotência do servidor). Persistem riscos de sessão com conexão perdida e de ACK atrasado, a verificar em C8.

### QA local obrigatório — Unity Editor + build Windows

Usar 1280x720 e 1920x1080, Editor Alfa + build Beta, Console e logs do Node. Cada caso deve registrar PASSOU/FALHOU, resultado real, evidências e resolução.

| Caso | Procedimento | Esperado |
| --- | --- | --- |
| C6-01 | Entrar Alfa e Beta | HUD/chat legíveis, sem erros da Unity |
| C6-02 | Clicar chat com mouse, digitar i e WASD | Inventário e movimento não disparam |
| C6-03 | Enter ativa chat; texto + Enter (repetir numpad) | Apenas UMA mensagem; não reabre no mesmo frame |
| C6-04 | Enviar pelo botão; selecionar Local/Trade/Support/Guild | Prefixos corretos, só Node autoriza |
| C6-05 | Tentar enviar offline, reconectar | Aviso; texto não some; sem reenvio automático |
| C6-06 | Esc e três reentradas no Play Mode | Foco e listeners limpos |
| C6-07 | Combate, cura, level-up, morte/respawn | Valores iguais ao Node, XP total separado, FPS estável |
| C6-08 | Inventário vazio/12+ itens/pilhas, scroll, I e X | Acesso a todos os itens, sem sobreposição |
| C6-09 | Equip/unequip, duplo clique, slots incompatíveis e drag | Só snapshots confirmados alteram slots |
| C6-10 | Depósito/saque e duplo clique rápido | Uma solicitação por resultado, botões aguardam ACK |
| C6-11 | Comprar 0, quantidade inválida e normal; spam | Sem gold local fictício; Merchant sem limite stock |
| C6-12 | Loot de 1/3/8 itens, TakeAll, disputa dois clientes | Rolagem, índices e erros, sem duplicação |
| C6-13 | Alternar duas resoluções com painéis/chat abertos | HUD, chat, inventário, equipamentos acessíveis |

Comandos locais, SEMPRE fechar Unity primeiro:

    git status
    git stash push -u -m "backup Unity antes de atualizar C6"
    git fetch origin
    git switch dev
    git pull --ff-only origin dev
    git log -1 --oneline
    git status
    git stash list

Não usar stash pop automaticamente: revisar o stash antes de recuperar mudanças de cena/prefab. CI Node checa contratos C# estaticamente, não compila nem executa C#/Canvas. C6 só se encerra após homologação local; C7/C8 continuam independentes.


## 8. Evidência de integração após QA automatizado

O PR [#102](https://github.com/richzago/ZagoQuest/pull/102) foi MERGED na dev no commit 26526d3c38623113402332e62b3f1ba3aa4ffd90. A [CI pré-merge](https://github.com/richzago/ZagoQuest/actions/runs/41230928166) terminou SUCCESS em Windows/Linux/PostgreSQL: 463 testes, zero falhas. O caso C4 do PlayerHUD foi adaptado ao helper DisplayBar sem remover a checagem do XP total/level e singleton. Testes de contrato cobrem também estados vazios (inventário, loja e loot). [CI pós-merge](https://github.com/richzago/ZagoQuest/actions/runs/41231055822) iniciada; conclusão a confirmar. C6 exige os 13 testes manuais da seção 7 e comparação de imagens. Main intacta.
