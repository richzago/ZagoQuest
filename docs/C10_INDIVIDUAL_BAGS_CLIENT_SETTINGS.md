# ZagoQuest C10 — Bolsas por instância, Merchant, Loot e cliente configurável

> **Atualização C11 (01/11/2026):** a especificação vigente da interação NPC, loot por distância, **Shift+L**, múltiplas Bags com UUID individuais na UI e tema original **Obsidian & Bronze** está em [C11_NESTED_BAGS_NPC_LOOT_OBSIDIAN.md](C11_NESTED_BAGS_NPC_LOOT_OBSIDIAN.md). Atalhos e detalhes de layout abaixo podem representar a etapa C10 anterior. **CAP por peso ainda não está implementado**, apenas limites por slots. PR #119 permanece Draft, sem merge.


**Ramo de homologação:** `feature/server-authoritative-containers-loot-c9` — PR [#119](https://github.com/richzago/ZagoQuest/pull/119), **base `dev`, Draft, sem merge**. Mantido no mesmo ramo por pedido explícito após falhas encontradas no Unity em 01/11/2026.

## 1. Bugs reproduzidos e causa

| Bug | Diagnóstico | Solução |
|---|---|---|
| Itens da Bag largada aparecem numa nova | `Player.inventory` era o mesmo `Map` global; `EquipmentSlot.BACKPACK` apenas selecionava capacidade | Cada instância tem UUID, itens e filhos próprios; `inventory` expõe conteúdo somente da **Bag atualmente equipada**. O objeto no chão conserva seu estado completo. |
| Comprar poção sem Bag | `ShopSystem.buyItem` usava `canAddItem` sem verificação de capacidade | Compra normal usa `canCollectItems`; só a primeira Bag válida (1 unidade) pode ser comprada sem Bag para evitar softlock. Log `[SERVER LOG][SHOP]` e feedback específico. |
| Clique no loot não transfere | Root de algumas linhas dependia do prefab/raycast; o Node também rejeita coleta sem Bag/slots | `LootItemSlot` garante Image raycastable no próprio root, textos não bloqueantes, logs de índice/corpse; Node revalida e informa recusa por `lootError`. |
| Arrastar loot para Bag falha | Dependência dos mesmos índices/recebimento de `OnDrop`; tela anterior ocupava espaço excessivo | Mantido `takeLoot` autoritativo (sem conversão para pickup do chão), root clicável e drop target do viewport/célula. Requer homologação Unity, não inferir sucesso só pela CI. |
| Take All não funciona | Atalho `Ctrl+Shift+L` pouco acessível | **Shift+E** com Loot aberto e fora de chat/input, mais botão compacto `⇧E` na faixa do Loot; transferência atômica por `canCollectItems`. |
| Um Loot já lota sidebar | Sidebar C8 fixava 304px e seções longas; espaço dinâmico pequeno | Coluna principal padrão 228px; seções minimapa/equip/quick acess mais baixas; Bag até 112px e Loot até 128px; scroll vertical; novos cadáveres substituem antigos no LRU local de 4. |

## 2. Semântica de contêineres

### Estado do servidor

A configuração `containerSlots` continua **por JSON** em `server/src/data/items/equipment/backpack/`:
- `simple_bag.json`: `containerSlots: 10`;
- `basic_backpack.json`: `containerSlots: 20`;
- futuras Bags: `containerSlots: 40` (ou outro valor).

`Player.bagInstances` armazena instâncias por UUID: `{id,itemId,items,children}`. `Player.equippedBagInstanceId` seleciona **uma** identidade equipada. `Player.inventory` permanece como projeção compatível do conteúdo da Bag ativa, para não reescrever todos os handlers; sua referência muda ao equipar/swap. `Player.exportBagState/restoreBagState` convertem/recuperam o JSON.

- **Drop da Bag equipada:** retira exatamente sua instância do equipamento e move `BagStateSave` (incluindo filhos, quando houver) para `ItemOnGround.bagState`. Jogador fica sem Bag ativa e sem seus itens. Isso não duplica nada.
- **Compra da nova Bag sem outra equipada:** cria instância nova vazia, autoequipa; **não reutiliza os itens da Bag antiga**.
- **Pickup da Bag caída:** retoma estado e identidade originais. Se personagem sem Bag, autoequipa; se já equipado, adiciona a Bag antiga como unidade dentro da Bag ativa, respeitando slots. Trocar para a Bag antiga reabre seus itens.
- **Trocar Bags:** remove a Bag selecionada do conteúdo da bolsa anterior e guarda a antiga como subitem na nova (contêineres com conteúdo conservam identidade). Só permite se a nova comportar pelo menos a Bag antiga.
- **Vender Bag:** só vazia, para nunca apagar conteúdo; uma Bag vazia, desequipada e única pode ser vendida mesmo sem outra Bag equipada.
- **Múltiplos itens com mesmo itemId:** cada contêiner comprado recebe UUID independente; `itemId` por si só nunca identifica conteúdo. O protocolo de `dropItem.fromEquipment` distingue origem.
- **Moedas:** após pickup/loot dentro da Bag continuam convertidas em gold conforme sistema atual; sem Bag, item no chão não pode ser coletado.
- **Saves C9 existentes:** primeiro carregamento com Bag equipada converte o antigo `character.inventory` inteiro em conteúdo da Bag ativa, sem apagar itens, mesmo se exceder capacidade (novas coletas continuam bloqueadas até liberar slots). Não há migração destructiva.
- **Persistência:** `Character.containerState` JSONB recebe os registros no mesmo `DatabasePersistence.saveCharacter` e volta via `loadCharacter`.

### Upgrade obrigatório de PostgreSQL local

**Não executar contra banco real sem backup.** Com servidor parado e backup restaurável, no pgAdmin Query Tool para sua database do ZagoQuest:

```sql
ALTER TABLE "characters"
ADD COLUMN IF NOT EXISTS "containerState" jsonb NOT NULL DEFAULT '{}';
```

Há uma migration versionada `1793500000000-ContainerInstances.ts` para instalações que executam migrations de forma controlada. **Não rodar `db:init:test` num banco existente:** esse comando é intencionalmente restrito a banco DESCARTÁVEL vazio e agora executa migration baseline + C10. `DB_SYNCHRONIZE=true` só é permitido em ambiente local de desenvolvimento; não usar em produção. A migração não altera a coluna antiga `inventory`.

**Limite conhecido:** Itens/bolsas caídos vivem no `World` em memória; o servidor atualmente **não persiste itens do chão em reinícios**. Enquanto essa persistência do mundo não existir, reiniciar o Node com uma Bag cheia caída no chão pode resultar na perda do objeto. Recuperar a Bag antes de encerrar o servidor, especialmente no QA. **Não confundir persistência do conteúdo de Bags do personagem com persistência de itens do mundo.**

## 3. Interface configurável

O ícone de **engrenagem** no Acesso Rápido abre `C10ClientLayoutSettings` (Canvas com botões reais, sem mexer na Hierarchy manualmente). As opções são salvas em `PlayerPrefs` local:

- **Colunas à esquerda:** 0 a 3; **à direita:** 1 a 3 (primeira = sidebar principal de equipamento/minimapa/atalhos).
- **Largura:** Compacta (228px padrão) ou Conforto (276px).
- **Bag e Loot:** Esquerda, Principal ou Extra direita. A colocação reaproveita **os painéis originais**, em hosts com máscara/scroll. Se a coluna pedida não existe, usa a coluna principal como fallback.
- **Faixas de magias:** Topo, Centro e Inferior ativáveis individualmente. São exclusivamente **reservas visuais**, sem servidor de magias, cooldowns, slots de feitiços ou bindings de gameplay implementados; são não interativas e não interceptam cliques.
- **Tela pequena:** menos colunas extras ficam fisicamente visíveis para manter ao menos área útil de jogo; preferência salva permanece e volta a aparecer numa tela maior. `C8PlayfieldViewport` recorta SOMENTE a câmera original para colunas de ambos os lados; F10 mantém controle de escala.
- **Mudança de colunas em runtime:** `C8SidebarDynamicDock.ReturnToPrimaryHost` protege os `RectTransform` originais antes da destruição de um host; novo host reencaixa sem duplicar UI/reiniciar Gameplay. `NetworkManager` cria a UI de preferências apenas uma vez.

## 4. Testes automatizados

- `server/tests/c10IndividualBagState.test.ts`: Merchant sem Bag recusa poção, nova Bag vazia, Bag caída conserva conteúdo, recuperar/swap, duas Simple Bags iguais com UUIDs, export/restore JSON, venda segura, loot com índice intermediário e takeAll.
- `server/tests/economy.test.ts`: drop de equipamento/origem, pickup do chão, não duplicação, distância, loot atomicidade.
- `server/tests/clientC8*.test.ts`, `clientC9*.test.ts`, `c9ContainersCapacity.test.ts`: passaram a ser explicitamente incluídos em `npm test` junto dos C10; contratos estáticos atualizados para C10.
- CI: `npm run build`, `npm test` Ubuntu/Windows e PostgreSQL em database CI descartável. **C# não é compilado no GitHub Actions**.

## 5. Checklist de homologação no Unity (NÃO MERGEAR antes de concluir)

- [ ] Personagem antigo com Basic Backpack+itens: após atualizar coluna SQL, login preserva tudo, contador correto; logout/relogin idem.
- [ ] Equipar Basic com poções, largar no chão e comprar Simple Bag: Simple **vazia**; recuperar Basic e equipar: poções voltam **somente na Basic**.
- [ ] Comprar 2 Simple Bags iguais: equipar e alternar, conteúdo não troca de dono; UUIDs persistem após logout.
- [ ] NPC Merchant recusa poção sem Bag e não consome gold; compra 1 Simple Bag sem Bag funciona (autoequip); com Bag e espaço aceita poção.
- [ ] Bag cheia não pode ser vendida e não apaga nenhum item; Bag vazia pode ser vendida.
- [ ] Loot do 2º/3º item por clique: um pacote e ACK de índice, atualiza linha/slot; server log/ChatUI em erro.
- [ ] Drag loot→Bag (sobre célula vazia ou ocupada) coleta **uma** vez; loot→chão mantém caminho próprio sem duplicar.
- [ ] **Shift+E** e botão `⇧E` pegam tudo quando couber; Bag cheia recusa atomicamente sem perder itens.
- [ ] Layout: engrenagem abre/fecha configurações, ajusta colunas 0–3 esquerda / 1–3 direita, Bag e Loot podem usar lados separados, opção Compacta/Conforto e persistência PlayerPrefs.
- [ ] F10 100/115/130%, 1920×1080 e 1280×720: área jogável não desaparece; cliques não são bloqueados fora das colunas; minimizar/mudar colunas não destrói original InventoryUI/LootUI.
- [ ] Faixas de magias topo/centro/inferior são decorativas, não consomem teclas/casting.
- [ ] 5 cadáveres: novo ocupa slot recente, antigo sai do histórico **local**, segue no mundo; navegação < e > atualiza snapshot.
- [ ] NPC sobre item, click 1 START / click 2 STOP no monstro, pesca, Banker, Merchant e logout sem regressões.
- [ ] Com Bag cheia no chão, **recolher antes de reiniciar Node** pela limitação de world persistence documentada.

**Nenhum merge no PR #119 até aprovação explícita.**
