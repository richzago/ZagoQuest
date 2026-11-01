# C18 — Integridade, pilhas físicas, HUD e minimapa

**Branch:** `feature/c18-atomic-inventory-slots-hotkeys-minimap` · [PR #124 DRAFT](https://github.com/richzago/ZagoQuest/pull/124) · Base `dev` após merge C17 `880787f`.

## 1 — Drop/pickup com commit conjunto em PostgreSQL

**Antes:** `World.onGroundItemsChanged` agendava snapshots de chão assíncronos; `DatabasePersistence.saveCharacter` persistia separadamente. Se o Node morresse entre gravações, a transferência personagem↔chão podia duplicar ou perder itens.

**C18:** os handlers `handleDropItem` e `handlePickupItem` chamam `GroundCharacterTransaction.execute(world,player,mutate)`:
1. Aguardar gravações anteriores do chão e adquirir `withCharacterWriteLock` pelo UUID.
2. Capturar equipamento, conteúdo de Bags, UUIDs, inventário/Gold e itens existentes no chão para rollback.
3. Suspender temporariamente o agendamento independente do chão; revalidar posse/UUID e mutar os estados em memória.
4. Executar **uma transação `AppDataSource.transaction`** que salva o Character por `EntityManager` e substitui snapshot de `ground_items` no **mesmo commit**.
5. Em falha, rollback SQL automático e restauração do estado de jogador/chão em memória; em êxito, envio dos pacotes de inventário e spawn/despawn ocorre após commit.

**Teste integrado real:** `phase4PostgresIntegration.test.ts` mantém guarda explícita de banco descartável `DB_NAME=zagoquest_ci`, `RUN_PG_TESTS=true`; dois cenários C18: commit de transferência e trigger SQL que força falha de inserção do chão, provando que ambos os lados permanecem no estado pré-operação.

**Escopo e riscos residuais (P1):** isso protege **transferências de drop/pickup feitas pelos handlers** contra crash entre as duas gravações SQL. Não significa atomicidade universal do jogo: persistência de loot/corpos, pesca, compras e alterações simultâneas do personagem por outros sistemas ainda precisam de análise de concorrência. Os callbacks de gameplay disparados por `addItem` podem ocorrer antes do commit e necessitam revisão para efeitos colaterais externos; o callback da fila de chão é restaurado no final. Testar queda real do processo em ambiente descartável antes de alegar proteção completa. Em testes sem conexão de banco, o wrapper preserva o comportamento legado, mas sem garantia transacional.

## 2 — Slots físicos e pilhas independentes por `maxStack`

**Dados:** acrescentado `PhysicalSlot {id,itemId,amount}` e `BagInstanceSave.slots?: PhysicalSlot[]`, mantendo `items: Record<itemId,qty>` como agregação compatível com saves C10–C17. Migração é gerada na leitura/exportação de Bags, não exige reset ou drop de inventário. IDs persistidos são conservados durante reconciliação; duplicados são descartados e substituídos, sem alterar as quantidades agregadas. O sistema não materializa mais de 10 mil pilhas de um único tipo durante migração: solicita auditoria de legado anômalo ao invés de esgotar memória.

**Regras:** `countPhysicalSlots` conta `ceil(qty/maxStack)` para itens stackable e uma posição por unidade para não-stackable. As validações de CAP e vagas físicas em `Player.canCollectItems`, `Player.addItem`, transferências Bag→Bag e compras de NPC verificam contagem final. `Loot` e `Fishing` usam `Player.addItem`/validação, impedindo pilhas ocultas acima da capacidade; moedas continuam convertidas em Gold sem consumir slot. Uma Bag pode conter múltiplas pilhas do mesmo `itemId`, cada uma com `slotId` e `slotIndex` na mensagem de inventário; Unity exibe linhas físicas em vez de uma soma visual.

**Transição ainda pendente:** `Map<itemId,qty>` continua a fonte agregada para operações antigas e drag/uso de item do cliente ainda seleciona por `itemId`, não por `slotId`. O sidecar físico serve para persistência, capacidade e visualização sem apagar dados antigos, mas a migração para comandos por slot específico deve ser um passo adicional antes de declarar o modelo totalmente canônico.

## 3 — Qualidade de vida da HUD e atalhos

`C18HudHotkeys.cs` cria atalhos locais por `PlayerPrefs`:
- **F6** alterna Backpack; **F7** alterna Stats; **F8** fecha Loot quando aberto (não abre cadáver que não foi selecionado).
- No painel de configurações, há três linhas para alternar entre F6, F7, F8, F9, F11, F12 e desligado, sem permitir dois comandos com a mesma tecla.
- Não captura teclas em campos TMP nem com o painel Settings aberto. O botão `X` do Loot real volta a estar visível para fechamento com mouse.

## 4 — Stats e Backpack em painéis separados

`C8SidebarShell` cria `C18StatsHost` como **irmão** de `SidebarDynamicHost`, em `DynamicContentSection`. Quando Stats abre, o primeiro host usa uma altura até ~265px, e o segundo mantém o espaço restante, com mínimo buscado para a Bag em 720p. `C8SidebarDynamicDock` não chama `StatusManager.ClosePanel` ao abrir Bag/Loot nem oculta Bag por Stats ativo. Cada um guarda estado e scroll próprios.

## 5 — Minimapa real do Tiled (primeiro estágio)

`C18TiledMinimap.cs`, anexado ao preview original do minimapa, acessa `TiledMapRenderer.mapJson` e interpreta a layer `Ground`, invertendo Y como o `TiledMapRenderer`. A posição do jogador é obtida por `PlayerController.TryGetConfirmedGridPosition` (a posição confirmada por WebSocket/Node); nunca usam-se cliques ou predições locais como fonte autoritativa. Renderiza janela móvel de 32×32 tiles em textura 96×96 (filtro point), escurece colisões e centraliza marcador dourado. Só reconstrói quando o jogador muda de tile. Não envia requisições adicionais ao servidor.

**Ainda não é minimapa completo estilo Tibia:** GIDs recebem cores semânticas (não pixel art real), não há descoberta/fog of war, zoom interativo, marcadores de quests/NPC ou múltiplos andares. O cliente precisa usar o **mesmo JSON Tiled** que o servidor. Se não encontrar mapa válido, o placeholder `CARREGANDO` permanece sem afetar gameplay.

## Testes automatizados

- `server/tests/c18PhysicalSlots.test.ts`: seis cenários de pilhas 10+10+1, migração de save legado preservando UUIDs, reconciliação/consumo, lotação física, separação de tipos e contratos estáticos de Unity.
- `server/tests/phase4PostgresIntegration.test.ts`: dois testes C18 adicionais com PostgreSQL real descartável, inclusive trigger de falha/rollback.
- Contratos C9/C14/C17 anteriores ajustados somente onde a **regra física mudou**; não confundir casos legados sobrelotados com compra/loot permitido.
- `npm run build` valida TypeScript, **não compila Unity C#**. Testes de pixel, cliques, scene hierarchy, Tiled e F10 permanecem manuais.

## Checklist de homologação Unity C18

- [ ] Compilar Client sem erros C# e confirmar login/conexão.
- [ ] Recolher/deixar potion comum e Bag aninhada cheia no chão, reconectar/reiniciar Node normalmente; UUIDs, CAP, itens e Gold consistentes.
- [ ] Simular erro de conexão PostgreSQL em **ambiente descartável**, nunca na `zagoquest` real, e verificar feedback sem item fantasma; conferir trigger do teste integrado.
- [ ] NPC vende 11, 21 ou mais potions em várias pilhas de no máximo 10, inclusive duas pilhas na mesma Bag; testar limite de slots/CAP e ouro não debitado se recusar.
- [ ] Loot, Take All, Shift+L, pickup e Fishing respeitam pilhas físicas, CAP e limite de slots sem perda nem overstack.
- [ ] Duas Bags com o mesmo tipo e IDs diferentes conservam suas próprias pilhas e conteúdo após drop, pickup e novo login.
- [ ] Stats e Backpack abertos **ao mesmo tempo** (não no mesmo painel) em 720p/1080p e F10 100/115/130%; rolagem e clique nos slots não bloqueiam NPC nem mapa.
- [ ] F6/F7/F8 funcionam; configurar outras teclas em engrenagem; preferências sobrevivem reinício do cliente; Chat/inputs não disparam hotkeys; o botão X fecha Loot.
- [ ] Minimap mostra terreno real do Tiled e posição do jogador (marcador dourado) mudando só após ACK do servidor; bordas, colisão, spawn, novo login e reset de mapa.
- [ ] Regressões combate/morte/respawn, NPC merchant/banker, pesca, reconexão, logout, barra de equipamentos e configurações.

**Governança:** [PR #124](https://github.com/richzago/ZagoQuest/pull/124) permanece **OPEN/DRAFT**, sem merge na `dev`, até homologação Unity e autorização expressa.
