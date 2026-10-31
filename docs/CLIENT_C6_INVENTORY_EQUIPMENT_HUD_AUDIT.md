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


## 9. C6 P1 — Drop distante e duplo EndDrag (31/10/2026)

**Relato Unity:** arrastar `bone_sword` para tile distante gera `EndDrag` seguido de `EndDrag chamado mas não está arrastando` e `Drop: Local de drop inválido ou distante`. É bug comprovado de ciclo de arraste e feedback; os logs não comprovam por si um crash, portanto repro no Editor/build é necessária.

**Causa:** `InventorySlot.OnEndDrag` e `EquipmentSlotUI.OnEndDrag` invocavam `DropOnGround`, que já termina o drag, e logo invocavam `EndDrag` outra vez. O cliente enviava drop em qualquer posição sem verificar alcance. O Node `inventory.handler.ts` calcula `Math.floor(x/y)` e Manhattan `abs(dx)+abs(dy) <= 2`, recusando destino inválido ou distante **antes** de remover o item. Feedback do servidor era erroneamente registrado como LogError, mesmo sendo recusa esperada.

**Correção proposta:** `PlayerController.TryGetConfirmedGridPosition` oferece posição do último `init/position` Node (não posição de câmera); `DragDropManager.DropOnGround` confirma conexão, coordenadas finitas, usa FloorToInt e Manhattan <= 2, envia pedido apenas dentro de alcance, finaliza uma vez em `finally` e avisa pelo chat para alvo distante; slots de inventário/equipamento deixam de chamar EndDrag depois do drop; `DropErrorHandler` exibe recusa Node como warning/feedback. Não alterar economia, inventário local, regras de servidor ou mapa Tiled. Servidor ainda decide limites, posse, tiles e concorrência.

**Testes:** contratos estáticos `server/tests/clientC6InventoryEquipmentContracts.test.ts` verificam conversão, distância, `finally`, ausência de segundo EndDrag e mensagem; `server/tests/economy.test.ts` exercita `handleDropItem` real com alvos Manhattan >2, cardinal/diagonal na borda 2, preservação do item em recusa. CI Node não compila C# nem simula mouse.

### Homologação local P1 obrigatória antes de encerrar C6

| ID | Procedimento | Resultado esperado |
| --- | --- | --- |
| D1 | Arrastar `bone_sword` a 3+ tiles | Sem pedido dropItem, mensagem de distância; sem item desaparecer, sem red error/duplo EndDrag |
| D2 | Soltar a 2 tiles cardinais e 1+1 diagonal | Um pedido, chão recebe item; inventário só muda após snapshot Node |
| D3 | Soltar a 2+1 tiles na diagonal | Recusado localmente, item permanece |
| D4 | Dropar sobre outro slot, inventário, equipamentos, HUD e janela do banco | Não dropar no chão; equip/unequip operam normalmente |
| D5 | Arrastar item equipado até chão distante e perto | Distante recusa; perto despacha uma vez e equipamento atualiza por servidor |
| D6 | Soltar perto da borda do mapa ou tile inválido | Recusa autoritativa Node, feedback no chat, sem travar; nada perdido |
| D7 | Derrubar conexão e tentar drop; reconectar | Sem envio offline, aviso, drag limpo, item preservado |
| D8 | Repetir 10x perto/longe em Editor + build Windows | Nenhum estado preso ou segundo EndDrag; console sem exceções |
| D9 | Alfa/Beta competindo pelo mesmo tile | Servidor decide; inventários sem duplicações |
| D10 | Inspecionar Unity Console e servidor após rejeição | Apenas warning/aviso esperado, UI ainda responde a cliques/atalhos |

**Critério para C7:** integrar o PR após CI Windows/Linux/PG verde, mas aguardar reteste local D1–D10 para marcar a C6 homologada. Não afirmar que o servidor estava removendo item: o código recusa antes de mutar o estado.

## 10. C6 — HUD compacto, equipamento centro direito e food (31/10/2026)

Pedido do desenvolvedor: remover XP do HUD, mostrar nome+nivel, HP vermelho e mana azul, tornar painel mais compacto, mover equipamentos para o centro direito (minimapa futuro no topo direito) e fazer food recuperar HP/mana ao longo do tempo.

**Bug real mana:** characterService criava personagens com mana/maxMana 0/0 apesar de Player/Vocation.NONE prever 50/50. Criação API corrigida para 50/50. DatabasePersistence recupera apenas saves com maxMana<=0, após recalcular vocação; mana legitima 0 com maxMana positivo permanece 0. Schema PostgreSQL legado mantém default 0; o endpoint define explicitamente os dois valores, sem migracao destrutiva.

**HUD:** PlayerHUD recebe snapshots do Node; fill HPBar vermelho e ManaBar azul aplicado via Slider.fillRect (o tema antigo alterava HPSlider/ManaSlider da tela Status, não os do HUD principal). XPSlider e XPText do HUD ocultos sem apagar referências da cena; Status (P) segue mostrando XP. O nível fica destacado visualmente ao cruzar 90% de XP do nível, sem XP numérica no HUD.

**Layout equipamento:** anchor/pivot (1,0.5), anchoredPosition (-12,0), largura 276 e altura 500. Inventory permanece à esquerda, sem sobreposição horizontal. Topo direito reservado a minimapa não implementado.

**Food:** não existia regeneração por comer; condições existentes eram DoT e poções instantâneas. FoodRegenerationSystem no Node acrescenta saciedade até 120s (estado temporário em memória por sessão) e regenera 2 HP + 1 mana a cada 2s, respeitando max, sem ressuscitar. Queijo 40s, truta 45s, salmão 60s, perca 30s, peixe dourado 90s. Consumir retira UMA unidade e só envia inventory; tick do Node envia playerStats quando HP/mana mudar. Saciedade não persiste entre logins; HP/mana recuperados seguem persistencia existente. Poções mantêm recuperação instantânea. Não criar timer Unity nem incrementar stats no cliente.

### QA Unity Editor + build Windows (C6-H)

| ID | Teste | Resultado esperado |
| --- | --- | --- |
| H1 | Personagem novo e save antigo 0/0 | Novo 50/50; legado reparado; mana 0/50 legítima preservada |
| H2 | HUD 1280x720 e 1920x1080 | Nome, nível, HP vermelho, mana azul, XP oculta; Status/P conserva XP |
| H3 | Chegar a 90% da XP do nível | Level destaca visualmente, XP não aparece |
| H4 | Abrir inventário e equipamentos | Equipamentos no centro direito, slots clicáveis e topo direito livre |
| H5 | Comer queijo com HP e mana baixos | 1 alimento consumido; +2 HP e +1 mana por 2s, HUD reflete Node |
| H6 | Comer repetidamente e tentar no teto | Duração soma até 120s, sem ticks duplicados; recusa sem consumo |
| H7 | Comer com HP cheio e mana baixa | Só mana aumenta; ambos são limitados ao máximo |
| H8 | Usar poção HP/mana | Recuperação instantânea existente preservada |
| H9 | Morte, reconnect durante comida | Não ressuscita, não dá tick duplicado; food é sessão local |
| H10 | Testar Alfa e Beta simultâneos | Cada personagem recebe seus stats; sem vazamento entre jogadores |

Automação: foodRegeneration.test.ts exercita timer fake, teto de saciedade, tick de servidor, consumo/poção; characterPersistence.test.ts testa legacy 0/0 versus 0/50; clientC4/C6 contracts atualizados. CI Node não compila C# nem substitui QA visual. Só homologar C6 após H1-H10 e reteste D1-D10 do drop.

Para atualizar: fechar Unity; git stash push -u -m "backup Unity antes do C6 HUD food"; git fetch origin; git switch dev; git pull --ff-only origin dev; git status; git stash list. NUNCA aplicar stash pop automaticamente.


### Reteste adicional — poções existentes (bug real detectado pelos testes novos)

A nova suíte de food revelou que o handler de consumíveis esperava healAmount/manaAmount como campos diretos, mas os JSONs health_potion e mana_potion usam effect.healHp e effect.healMana. O Node negava a poção mesmo quando HP/mana estavam baixos. Corrigido por tipagem de ItemType.effect e leitura do contrato real. Adicionado teste real de ambas poções (recuperação imediata, clamp e rejeição sem consumir quando cheio), preservando food com efeito gradual. A CI só conta o teste foodRegeneration quando o arquivo é incluído explicitamente em server/package.json (npm test enumera cada arquivo). Incluir H8 com HP e mana potions e confirmar no Unity, além dos 10 casos principais.

## 11. C6 — Falha na ação dos consumíveis ao clicar (31/10/2026)

**Reprodução enviada pelo desenvolvedor (Console Unity):** duplo clique em consumable/cheese dispara InventorySlot.OnPointerClick -> InventoryUI.OnSlotDoubleClicked -> InventorySender.SendEquipItem. O Node responde que queijo não é equipável. Também há cliques simples em consumable/mana_potion e consumable/health_potion sem ação. Código anterior implementava single left como seleção e double left exclusivamente equipItem; right-click já usava useItem.

**Correção:** fluxo de duplo clique passa a InventorySender.UseItem: o Node diferencia consumable (food/potion) e equipment (equipar), sem o cliente inferir categoria pelo prefixo. Adicionalmente, o snapshot de inventory passa a incluir itemType opcional obtido do ItemRegistry; Unity InventoryHandler encaminha à InventoryUI/InventorySlot. Um clique simples ESQUERDO em consumable solicita useItem; outro clique no mesmo item dentro de 0,3s é ignorado para evitar duplicação acidental. Clique direito mantém useItem e duplo clique em equipamento também usa useItem. Arrastar para slot de equipamento continua usando equipItem (com validação Node). Itens com definição desconhecida/servidores antigos sem itemType mantêm o duplo clique/right-click genérico. O cliente não reduz quantidade, HP ou mana: aguarda o snapshot.

**Mana inicial zero:** a correção anterior (#106) criou novos personagens com 50/50 e converteu legados 0/0 durante load, mas um save com 0/50 é legitimamente preservado. Sem ler o registro real do personagem no PostgreSQL e seu playerStats não é possível afirmar se o valor 0 é persistência antiga ou gasto. PlayerStatsHandler agora registra uma única mensagem [PlayerStats] Node enviou mana 0/{maxMana} para diferenciar origem do servidor de problema de renderização. **Não restaurar mana automaticamente em todos os logins** (seria exploit e adulteraria saves que realmente gastaram mana). A mana pode agora subir via potion instantânea ou comida quando consumida. Para uma correção administrativa pontual de mana inicial legada, fazer backup e identificar personagem offline na base correta antes de qualquer UPDATE; nunca executar UPDATE global.

### Consultas de diagnóstico PostgreSQL (read-only, pgAdmin Query Tool)

    SELECT "name", "level", "mana", "maxMana", "hp", "maxHp", "updatedAt"
    FROM public.characters
    ORDER BY "updatedAt" DESC LIMIT 20;

Se mostrar mana=0 e maxMana positivo, o HUD está refletindo estado real do Node. Um ajuste de recuperação pontual, se desejado, exige decisão explícita sobre qual personagem e a origem do save. **Não** alterar DB nem recompor mana de outros jogadores automaticamente.

### Reteste Unity (Editor + build Windows, após atualizar dev)

| ID | Procedimento | Esperado |
| --- | --- | --- |
| U1 | Clique esquerdo uma vez em cheese, HP/mana abaixo do max | Um useItem, 1 queijo removido pelo Node, saciedade e regen a cada 2s |
| U2 | Clique esquerdo uma vez em mana_potion com mana abaixo max | Um useItem; mana sobe imediatamente; 1 potion sai no snapshot |
| U3 | Clique esquerdo uma vez em health_potion com HP abaixo max | Um useItem; HP sobe imediatamente; 1 potion sai no snapshot |
| U4 | Duplo clique rápido em consumível | Uma solicitação por sequência rápida, sem gasto duplicado intencionalmente |
| U5 | Clique direito em consumível | useItem, como antes |
| U6 | Duplo clique em bone_sword / drag em WEAPON | Equipa via Node; nenhum consumível enviado como equipItem |
| U7 | Item com barra cheia ou saciedade no teto | Node recusa no chat, inventário não perde unidade |
| U8 | Abrir personagem antigo e examinar log PlayerStats e Status/P | Checar mana/maxMana reais; potions/food restauram até máximo, sem inventar mana |

**Cobertura automática:** contratos C6 estáticos protegem useItem e metadados; teste real em foodRegeneration.test.ts valida o snapshot tipado e item legado. Node continua autoritativo. Testes de UI/Hierarchy e compilação C# devem ser executados localmente e não são cobertos pelo CI Node.

**Comandos locais obrigatórios:** fechar Unity, git status, git stash push -u -m "backup Unity antes da correção consumíveis C6", git fetch origin, git switch dev, git pull --ff-only origin dev, git log -1 --oneline, git status, git stash list. Nunca dar stash pop automaticamente.

## 12. C6 — Saciedade editável no JSON, food nerf, equip único, poção cheia, Login/Status

Relatório de testes de homologação: U1 food funcionou, mas sem capacidade apropriada; U2–U5 OK; U6 bone_sword equipou bone_armor junto (não desejado); U7 poções recusadas com vida/mana cheia (não desejado); U8 Status sobrepunha login. Esta seção PREVALECE sobre as configurações anteriores de food/potions na seção 10; C6 só homologa após testes Editor/build local.

### Configuração em server/src/data/items/*.json

Cada alimento permite alterar SEM TypeScript os campos abaixo (reiniciar Node para recarregar JSON):
- `satietyPoints`: pontos que ocupa dos 120 de capacidade do personagem. Ao ficar em 120, não consegue comer novamente enquanto durar o efeito; também recusa comida que não cabe inteira sem removê-la.
- `foodSeconds`: duração limitada da regeneração de cada unidade, independente da saciedade.
- `regenTickSeconds`: intervalo entre pequenos pulsos de recuperação.
- `regenHpPerTick` e `regenManaPerTick`: recuperação por pulso. Até 10 por pulso no guard do Node, zero é permitido se o outro atributo recuperar pelo menos 1.

**Valores iniciais de balanceamento (nerf)**:

| Alimento | Saciedade (max 120) | Duração | A cada 3s | Recuperação total por unidade |
| --- | ---: | ---: | --- | --- |
| Cheese | 20 | 6s | +1 HP, +1 Mana | +2 HP, +2 Mana |
| Meat | 40 | 9s | +2 HP, +1 Mana | +6 HP, +3 Mana |
| Trout | 30 | 9s | +1 HP, +1 Mana | +3 HP, +3 Mana |
| Salmon | 40 | 9s | +2 HP, +1 Mana | +6 HP, +3 Mana |
| Perch | 20 | 6s | +1 HP, +1 Mana | +2 HP, +2 Mana |
| Golden fish | 40 | 12s | +2 HP, +1 Mana | +8 HP, +4 Mana |

**Capacidade:** 6 queijos ou 3 carnes (ou mistura até 120 pontos) completam a saciedade. Cada unidade é processada como uma PORÇÃO em FILA com sua taxa individual de regen. Se consumir queijo seguido de carne, os pulsos do queijo NÃO ficam mais fortes retroativamente. Ao terminar a última porção, a saciedade zera e pode comer novamente. HP e mana são limitados ao máximo; nenhum alimento fornece XP/level. A duração e ganho não dependem do FPS do cliente. É intencional que food seja apoio fraco comparado com poções (50 HP/30 Mana instantâneos, segundo dados JSON). Saciedade não persiste entre sessões nesta versão (decisão pendente).

**Poções com atributos cheios:** enviar useItem sempre remove 1 unidade válida mesmo que HP/Mana já estejam cheios; não altera o valor e apenas envia feedback. Ao recuperar de fato, emite playerStats. Não fazer decremento direto na Unity.

**Equipamento único:** apesar de Node equipItem operar somente no itemId recebido, múltiplos clicks sobre slots instanciados/destruídos no mesmo frame podiam disparar novos comandos. InventoryUI desativa imediatamente os slots anteriores ao re-render, confere itemId ainda no snapshot e tem janela de 0,45s contra segundo equip acidental. Duplo clique em bone_sword deve equipar só espada; bone_armor permanece no inventário. Não altera drag normal. Se houver outra origem do equip automático, registrar mensagens WebSocket e reabrir a hipótese (não afirmar causalidade antes de Unity QA).

**Tela login e Status:** SessionLoginDebugUI.OnGUI deixa de renderizar formulário assim que o cliente tiver sessão válida, mesmo ao reconectar. Só exibe ícone ⏻ no canto inferior direito. O clique executa logout VERDADEIRO: limpa JWT e characterId da memória e fecha WebSocket, impedindo reconexão automática; zera formulário e fecha Status. StatusManager reorganizado em painel dark compacto à esquerda, ancorado no centro esquerdo, com HP vermelho, mana azul e XP detalhada. Tecla P só funciona conectado e tem unsubscribe correto de InputAction. Sem edição manual de cena/prefab. Ícone usa caractere Unicode, verificar renderização da fonte do Unity em build Windows.

### Reteste C6 — U9 a U17

| ID | Procedimento | Esperado |
| --- | --- | --- |
| U9 | Comer 6 queijos com HP/Mana abaixo dos máximos | +2HP/+2MP em 6s por queijo; após 6 unidades, barriga cheia |
| U10 | Comer 3 carnes (obter item primeiro) | 3 carnes somam 120 pontos, sem poder comer uma 4ª até a regen acabar |
| U11 | Cinco queijos e tentar uma carne; depois queijo | Carne recusada sem consumir (não cabe); 6º queijo permitido |
| U12 | Misturar queijo e carne, aguardar ticks | Taxas por alimento independentes (fila), não enche automaticamente HP/Mana |
| U13 | Gastar poção Mana/HP com atributo já cheio | Remove 1 poção, mantém atributo no máximo, informa desperdício |
| U14 | Duplo clique somente bone_sword com bone_armor na bolsa | Apenas WEAPON muda; bone_armor permanece na bolsa |
| U15 | Logar, abrir P, depois fechar | Login oculto, Status bonito à esquerda, sem sobreposição; XP preservada no Status |
| U16 | Clicar ícone ⏻ e fazer login outra vez | Desconecta WS, Status fecha, credenciais antigas não reaparecem; login retorna |
| U17 | Repetir no Unity Editor e Windows Build | Sem exception C#, clicks e barras sem sobreposição, servidor continua autoritativo |

Comandos após PR merge: FECHAR Unity, git status, git stash push -u -m "backup Unity antes C6 satiedade/Status", git fetch origin, git switch dev, git pull --ff-only origin dev, git log -1 --oneline, git status, git stash list. NÃO executar stash pop automaticamente.

**CI:** testes Node simulam relógio, porções, capacidade, poções cheias, equip único no handler; contratos estáticos validam C#. Não substitui compilação Unity e testes visuais.


## 13. C6 — Homologação adicional: equipamento persistido, logout, saciedade, venda, caixas e XP

**Relato:** 1) Bone Sword parecia equipar Bone Armor apenas na primeira vez; equipment iniciava vazio mesmo com save. 2) Logout ⏻ IMGUI não aparecia. 3) Mostrar saciedade no Status. 4) Merchant compra itens do mesmo catálogo com valor menor. 5) UI compacta e movível, com a ideia de caixas do Tibia. 6) Retornar a barra vermelha da XP no HUD.

### Diagnóstico / raízes

- **Bug confirmado no protocolo:** o snapshot de entrada do WS enviava init/inventory/playerStats/world mas NÃO incluía equipment; o PostgreSQL já tinha os equipamentos persistidos. Se a Bone Armor já estivesse equipada, a UI só passaria a mostrá-la quando o primeiro comando (Bone Sword) forçasse o primeiro snapshot de equipamento. Não concluir que dois itens foram equipados sem ver dois comandos WS. Corrigido adicionando sendEquipment(current) em initialSnapshot.
- **Race Unity possível:** EquipmentHandler podia receber o primeiro snapshot antes de EquipmentUI.Start mapear os slots da Hierarchy; UI passou a armazenar o último snapshot e aplicar depois do mapeamento. O backend Player.equipItem só altera o slot do itemId recebido; não há guard temporal no Node para não bloquear equips legítimos.
- **Logout:** o caractere Unicode na GUI imediata podia não aparecer/ser coberto pelo Canvas. Agora SessionLoginDebugUI cria um Canvas UGUI ScreenSpaceOverlay próprio de ordem 500, com botão de texto **⏻ SAIR** (mesmo que o ícone não exista na fonte, SAIR permanece legível), sem necessidade de editar hierarchy/prefab. Clicá-lo chama LogoutAuthenticatedSession, limpa credenciais em memória, encerra socket e mostra o login de novo.
- **Saciedade:** PlayerStatsSender.toPayload agora inclui satiety, satietyMax e foodSecondsRemaining calculados pelo FoodRegenerationSystem no Node. Ao comer, inventory.handler envia playerStats sem curar antecipadamente; ao expirar, mesmo com HP/mana no máximo, o mundo emite o último playerStats para zerar saciedade exibida. StatusManager cria campo C6SatietyText em runtime, ex.: "Saciedade 40/120 | 9s". Esses números são sempre snapshots, não cálculos Unity.
- **Merchant SELL:** ShopSystem.sellItem já existia, mas faltava WebSocket/Unity. Adicionados sellItem estrito no protocolo Zod, handleSellItem verifica NpcInteractionSystem.getActive (NPC, mundo, distância <=2), sellPrice do catálogo JSON, quantidade válida/possessão e saldo máximo; resultado sellResult, atualização inventory/gold somente após sucesso. O cliente nunca envia preço. ShopWindow passa sellPrice ao lado do buyPrice; ShopItemSlot gera segundo botão **Vender** e campo de quantidade compartilhado; sem estoque. No JSON do merchant foram incluídos exemplos de queijo, carne, Bone Armor e peixes, além dos itens anteriores. Rejeita preços de revenda >= compra (evita arbitragem) e moedas em revenda; mesmo catálogo para as duas direções.
- **Caixas compactas**: WorldWindowLayout.MakeDraggable cria cabeçalho arrastável (runtime) em Inventário, Equipamentos, Status, Chat, Banco, Loja e Loot, sem alterar arquivos de cena. Arrastar reposiciona; a posição fica salva localmente via PlayerPrefs. Botão direito **no cabeçalho** reseta posição. Loja 500x370, Banco 440x345, Loot 450x345, Chat 720x252; painéis de inventário e equipamentos mantêm scroll/slots e as ancoragens existentes. Resizing e dock/snap automático não estão implementados nesta passagem; não confundir com drag local. O Node não conhece nem persiste posição de UI.
- **XP**: PlayerHUD mostra de novo xpSlider/xpText, barra de XP vermelha distinta do HP, usa levelXp/levelXpToNext emitidos pelo Node (XP do nível, não cumulativa) para encher corretamente e resetar ao upar. HUD 314x190. O Status P continua detalhando XP total/histórica.
- **Autoridade e escopo:** sem edição de .unity e sem alterar main. Food/potions seguem dados JSON configuráveis, como etapa anterior. Client apenas apresenta. Nenhum recalculo de economia/XP no Unity.

### QA Editor/Windows U18–U33

| ID | Cenário | Resultado esperado |
| --- | --- | --- |
| U18 | Relogar personagem com sword/armor já equipados | Ambas aparecem em equipment imediatamente (primeiro snapshot, sem exigir novo equip) |
| U19 | Começar com armor persistida, equipar sword | Armor não muda, sword entra no WEAPON; Node envia apenas ação solicitada |
| U20 | 2 contas com equipment diferente, entrar/relogar | Cada cliente mostra somente equipment da sua própria conta |
| U21 | Após login, localizar **⏻ SAIR** canto inferior direito | Visível/clicável, sobre o Canvas, sem configurar Hierarchy |
| U22 | Sair e entrar novamente | WS encerra, sem auto reconnect indevido, login volta sem JWT/senha antigos |
| U23 | Comer queijo 1 unidade | Status P mostra 20/120 e segundos; regen leve após ticks |
| U24 | Atingir 120/120 saciedade | Status exibe cheio, bloqueia food adicional; ao expirar volta para 0 |
| U25 | Abrir Merchant próximo, comprar 1 health potion | Desconta buyPrice definido no NPC JSON, atualiza inventário/gold |
| U26 | Vender 1 potion no Merchant | Acrescenta sellPrice do NPC (menor que buyPrice), retira 1 potion |
| U27 | Tentar vender 2, com apenas 1, ou após se afastar do NPC | Recusa sem alterar gold/inventory |
| U28 | Trocar para NPC Banker, tentar continuar vendendo na loja antiga | Recusa por sessão de serviço diferente |
| U29 | Comprar/vender carne/peixe/Bone Armor | Catálogo e preços JSON corretos, sem estoque finito |
| U30 | Arrastar cabeçalho de Shop, Bank, Status, Loot, Chat, Inv e Equip | Painéis se movem e continuam clicáveis; posição local persistida ao reiniciar Play |
| U31 | Botão direito no cabeçalho | Restaura posição padrão da caixa |
| U32 | Ganhar XP até subir level | Barra vermelha do HUD cresce conforme levelXp/levelXpToNext e reinicia no novo level |
| U33 | Testar 1280x720 e 1920x1080, Editor e build Windows | Textos legíveis, sem colisão crítica; scripts C# compilam sem exception |

**Testes automáticos:** autenticado WebSocket real na CI garante primeiro snapshot de equipment e relogin; economia testa compra/venda, sessão, preço adulterado, quantidade, alcance, overflow e não arbitragem; food testa satiety reportada, expiração e isolamento entre players; contrato de C# verifica botão UGUI, painel arrastável, HUD XP, Status, merchant. CI Node/PG **não compila Unity**; Editor e Windows Build são obrigatórios antes de homologar visual.

**Atualizar Windows** (depois do merge): fechar Unity e servidor Node, git status; git stash push -u -m "backup Unity antes C6 merchant UI"; git fetch origin; git switch dev; git pull --ff-only origin dev; git log -1 --oneline; git status; git stash list. Nunca usar stash pop automaticamente.
