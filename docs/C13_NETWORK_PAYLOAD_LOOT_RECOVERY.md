# C13 — Contrato WebSocket, drag & drop e recuperação do Loot

Data: 01/11/2026 · Branch: `feature/server-authoritative-containers-loot-c9` · PR #119 permanece DRAFT, base `dev`.

## Reprodução: Unity C12

O Editor informou que `EquipmentSlotUI.OnEndDrag` chamou `DragDropManager.DropOnGround`, que chamou `InventorySender.SendDropItem` com `fromEquipment=true` e sem UUID, mas o servidor respondeu `[NETWORK] Mensagem recusada pelo servidor: Mensagem inválida`. Isso **localiza a falha antes do inventory.handler.ts**. A hipótese de Canvas bloquear o gesto era insuficiente para esse caso; o log "[TargetSelector] UI bloqueou clique Slot_Backpack" é esperado enquanto o cursor está sobre o slot.

### Causa de protocolo

Em `dev`, `DropItemMessage` tinha somente `type,itemId,amount,x,y`. A nova branch acrescentou campos opcionais `fromEquipment`/`instanceId`. O `BaseSender` utiliza `JsonUtility.ToJson`, que serializa campos públicos. `instanceId` sem conteúdo pode aparecer no pacote como `null` ou `""`, mas no Zod `identifier.optional()` significa **campo ausente OU string não vazia**, não aceita `null`/vazio. O log de rede não contém o JSON bruto para provar qual destas duas representações chegou; ambas são inválidas e eliminadas por esta correção.

**Correção:** novos DTOs tipados `OpenBagWithoutInstanceMessage`, `EquipItemWithoutInstanceMessage` e `DropItemWithoutInstanceMessage` com os mesmos campos obrigatórios, mas sem propriedade `instanceId`. O `InventorySender` escolhe estes DTOs quando não há UUID; quando há, envia os DTOs completos com ID, inclusive para Bags aninhadas. Mantém `fromEquipment` explícito e as validações Zod estritas; não usar `nullish()`, não aceitar UUIDs falsos nem inventar IDs do lado do cliente.

### Loot UI e raycast

A janela de loot em `C8SidebarDynamicDock.ApplyVisibility` tinha `anchorMin=(0,1)`, `anchorMax=(1,1)`, mas offsets verticais calculados como se ambas as âncoras estivessem no topo. Com `lootHeight=128`, isso ampliava a raiz do loot além de 128 pixels e gerava recortes/comportamentos de input inconsistentes. Ambas as âncoras do root agora estão no topo, com offsets delimitando exatamente `lootTop/lootHeight`; o `CanvasGroup.blocksRaycasts` continua dependente de `showLoot`. O arraste de cadáver para mundo usa o mesmo detector de UI visível da Bag. O relato "não consigo pegar loot" ainda **exige QA no Editor** para comprovar a resolução: ausência de stack trace de clique da linha impede afirmar de onde partiu a falha.

### Seis warnings do Unity tratados

- `SessionLoginDebugUI`, `LootItemSlot`, `C8SidebarShell` (2 ocorrências): `enableWordWrapping` substituído por `textWrappingMode`, `TextWrappingModes.Normal` ou `NoWrap`.
- `C7UiAccessibility`: `FindObjectsByType<CanvasScaler>(FindObjectsInactive.Include)` substitui overload com `FindObjectsSortMode`. O loop F10 permanece.

### Testes

- Criado `server/tests/clientC13NetworkAndLootContracts.test.ts`, incluído no `npm test`. Confere ausência física de campo opcional nos DTOs sem UUID, aceita pacotes efetivos no Zod, rejeita `null`/vazio/tipo errado, preserva origem equipada, verifica anchors do loot e APIs atualizadas.
- **CI C13 aprovada:** [GitHub Actions #41329598547](https://github.com/richzago/ZagoQuest/actions/runs/41329598547): **581 testes aprovados/0 falhas** em Ubuntu e Windows, build TS, integração PostgreSQL e smoke/dist concluídos. Testes TS confirmam **contratos estáticos**, não serializam DTO C# nem exercitam Play Mode. Unity continua pendente.
- **QA Unity obrigatório:** arraste Bag equipada→chão; drop item da Bag→chão; Bag com UUID válido dentro de outra Bag; NPC sob item; loot linha 1/2/3 e Shift+L/TODOS; drag loot→Bag e loot→chão; F10 e resoluções, login/logout; console sem seis warnings.

### Alcance desejado para drops distantes

O usuário sugeriu permitir lançar dentro de todo campo visível. **Não implementado nesta correção**: aumentar alcance demanda decisão explícita de gameplay e validação autoritativa por colisão/água/tiles proibidos (a câmera do cliente não é uma prova segura de alcance). O limite atual de Manhattan ≤2 permanece até os cenários básicos passarem.

**Não fazer merge em `dev` ou `main` sem autorização.**
