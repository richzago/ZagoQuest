## C18 — atomicidade, slots físicos, HUD independente e minimapa Tiled (01/11/2026)

**Estado:** [PR #124](https://github.com/richzago/ZagoQuest/pull/124) **OPEN/DRAFT — ainda NÃO integrado na `dev`**. Base: C17 homologada e integrada no merge `880787f`.

- [x] **Persistência transacional SQL de drop/pickup:** `GroundCharacterTransaction.execute` protege gravação de `Character` e snapshot de `ground_items` no **mesmo commit PostgreSQL**, após esperar escrituras anteriores do chão. Efeitos visuais de spawn/despawn ocorrem após commit. Erro de SQL reverte inventário, Bag UUID, equipamento e chão em memória. Revalidação sob lock reduz duplo drop/pickup do mesmo UUID.
- [x] **Teste PostgreSQL real** para commit conjunto e erro injetado em `ground_items` causando rollback de personagem e chão; restringido a `zagoquest_ci` pelo teste de integração existente.
- [x] **Pilhas físicas com UUIDs persistidos:** `BagInstanceSave.slots` é sidecar retrocompatível do Map legado. `physicalSlots.ts` preserva IDs e divide itens por `maxStack`. O servidor conta slots físicos em compras, transferência, Loot, pickup e Fishing (`addItem`), sem descartar quantidades em saves antigos. O `InventorySender` devolve linhas individuais com `slotId`/`slotIndex` para o Unity, que já desenha múltiplas entradas.
- [x] **HUD**: novos atalhos locais (Backpack F6, Stats F7, fechar Loot F8), alteráveis na janela de configurações sem duplicar teclas; captura bloqueada em TMP_InputField e com Settings aberto; botão fechar real do Loot recuperado.
- [x] **Stats e Backpack simultâneos**: `StatsHost` separado do `SidebarDynamicHost`, realocação de altura automática e rolagem independente, sem fechar uma janela ao abrir a outra.
- [x] **Minimapa do Tiled**: `C18TiledMinimap` renderiza terreno/colisão do JSON local e posição confirmada pelo servidor no centro; redesenha somente quando a célula muda, sem novos pacotes WS. Ainda usa cores semânticas determinísticas para GIDs (não sprites originais nem fog of war).
- [x] Criados testes estáticos/funcionais C18 e testes SQL de falha simulada; ajustes nos testes históricos para refletir a nova capacidade física por `maxStack`.
- [ ] **Homologar no Unity:** compilar scripts C#, login/respawn; drop/pickup com reinício e falha de banco, Bags contendo pilhas e UUIDs, NPC/loot/fishing, CAP, drag, HUD/atalhos/configurações, Stats+Backpack, minimapa/posicionamento e 720p/1080p/F10.
- [ ] Verificar crash abrupto em staging com **processo interrompido em pontos da transação**, sem executar testes destrutivos na database `zagoquest` do usuário.
- [ ] **Limitação P1**: transação conjunta está integrada especificamente a **drop/pickup**, não a todos os fluxos de loot/corpse/fishing e operações de terceiros que alteram personagem durante uma transação. `Map<itemId,qty>` segue índice agregado legado; UI não envia ainda um `slotId` em cada comando de drag específico. Há riscos residuais a auditar, não afirmar sistema anti-dupe universal.
- [ ] **Não realizar merge do PR #124 até autorização expressa após testes Unity.**

[Relatório técnico e checklist C18](C18_ATOMIC_STACKS_HUD_TILED_MINIMAP.md)

---

## C17 — compra segura em Bags aninhadas + UI compacta (01/11/2026)

- [x] C16 homologada 7/7, [PR #122](https://github.com/richzago/ZagoQuest/pull/122) integrada na `dev` (`4d02a8f`).
- [x] Criada branch `feature/c17-nested-purchases-compact-sidebar-stats` a partir do merge e [PR #123](https://github.com/richzago/ZagoQuest/pull/123) **Draft**.
- [x] Compra de NPC sempre planejada no servidor: Bag raiz e descendentes de UUID alcançável, independente da Bag aberta no cliente; seleciona pilha existente primeiro, depois espaço livre.
- [x] `maxStack` de potion respeitado por Bag na compra (um Map por tipo por Bag); quantidade que não cabe completamente recusa a transação inteira sem retirar gold. CAP e dinheiro checados antes de inserir.
- [x] Compras de novas Bags criam UUIDs em cada contêiner destino; mensagem avisa quando item foi colocado em Bag interna. Drop da Bag com conteúdo mantém árvore C14/C15.
- [x] Sidebar sem títulos redundantes/abas adicionais: removidas as escritas contêineres, acesso rápido, equipamentos e duplicatas Backpack/Loot/TODOS e setas de cadáver.
- [x] CAP representa somente capacidade restante recalculada pelo Node; mini mapa **placeholder** maior, equipamentos compactados.
- [x] Stats passa a ser aberto pelo ícone **S** na barra e não mais pela tecla `P`; painel de atributos usa scroll no host dinâmico sem cobrir gameplay, alternando com Bag/Loot.
- [x] Acrescentadas regressões C17 no Node e atualizados contratos estáticos legados de UI; atenção: CI Node não compila scripts C#.
- [x] **Homologação manual C17 parcial — 7/8 cenários OK (01/11/2026).** Aprovados: compra de potions com raiz cheia/Bag filha vazia e débito correto; árvore cheia/CAP insuficiente sem desconto; `maxStack=10` e distribuição entre Bags; compra/drop/pickup de Bag aninhada com UUID e conteúdo íntegros; sidebar sem títulos/abas/setas/TODOS duplicados; CAP restante atualizado; regressões NPC, Loot, pesca, banco, logout, 1280×720, 1920×1080 e F10.
- [x] **Bug C17 identificado e corrigido no código — Stats ocultos:** `StatsIcon` era o sexto ícone, sobreposto pelo `OFF` que usava o mesmo sexto espaço. Agora engrenagem é 0/7, Stats é 1/7 (visível, ao lado), demais ícones são 2–5/7, logout fica na célula exclusiva 6/7. Texto OFF reduzido para 11 pt para não cortar. `StatusManager` restaura o docking caso `Start()` e `TryDock()` terminem em ordem diferente; testado por contratos estáticos.
- [ ] **Reteste Unity obrigatório — Stats:** confirmar ícone `S` visível imediatamente ao lado da engrenagem, clique abre/fecha Stats, tecla `P` inativa, scroll/valores do Node, layout sem sobreposição, abertura/fechamento após NPC/Bag/Loot/F10, logout e login. A correção foi commitada, mas **ainda não homologada no Editor**.
- [x] [GitHub Actions #41342565817](https://github.com/richzago/ZagoQuest/actions/runs/41342565817): **611/611 testes Node no Ubuntu, 611/611 no Windows, integração PostgreSQL e compilação TS aprovados.** Unity C# ainda requer Play Mode manual.
- [ ] **Não fazer merge da C17 antes de homologação e autorização expressa do usuário.**
- [ ] Dívida técnica: inventário físico por slot/pilha para suportar várias pilhas do mesmo itemId dentro de uma mesma Bag; hoje Map por itemId limita uma pilha por Bag.
- [ ] Dívida de segurança transacional: persistência de personagem e itens do chão ainda são commits separados sob crash abrupto.

[Relatório C17 e checklist](C17_NESTED_SHOP_COMPACT_SIDEBAR_STATS.md)

---

## C16 — 4 slots por padrão, rolagem fina e altura ajustável (01/11/2026)

- [x] C15 [PR #121](https://github.com/richzago/ZagoQuest/pull/121) integrado à `dev` a pedido do usuário, mesmo com homologação anterior 6/8; commit de merge `6c80da4`. A UX de slots/scroll ficou para C16.
- [x] C16 [PR #122](https://github.com/richzago/ZagoQuest/pull/122) homologado no Unity (7/7) e integrado na `dev` por autorização do usuário; commit `4d02a8f`.
- [x] Backpack inicia com 2×2 slots visíveis e células vazias até a capacidade de slots informada pelo Node.
- [x] Scroll de Backpack/Loot em passos de até 18 pixels por evento, sem saltos por deltas ±120; scrollbar funcional com viewport separado, roda também sobre o trilho.
- [x] Layout redimensionável no eixo vertical por alça inferior de Bag e Loot, limitado pela altura disponível na coluna, conteúdo e painel adjacente; preferência local via PlayerPrefs.
- [x] Atualização parcial da lista de Loot não retorna o scroll ao topo.
- [x] Testes estáticos/contratos C8/C9 atualizados e criados testes C16; **ainda não equivalem a Play Mode Unity**.
- [x] **Homologação Unity C16 — 7/7 cenários aprovados pelo usuário em 01/11/2026:** 2×2 slots e vazios, roda sem saltos, puxador de scrollbar até último item, alça de redimensionamento de Bag, redimensionamento/Loot/TODOS, mesma coluna e colunas separadas em 1280×720 e 1920×1080 com F10, recusa de Bag cheia e transferências inválidas sem perda/duplicação observada. Testes manuais relatados pelo usuário, separados da CI.
- [x] **Integridade funcional Bag cheia e recusas de transferências:** homologadas manualmente pelo usuário sem perda ou duplicação observada; os testes automatizados C15 verificam posse/UUID/ciclos/slots. **Não confundir essa evidência com testes de invasão usando UUID forjado no Unity.**
- [ ] Aguardar autorização explícita para integrar PR #122 na `dev`.

[Relatório técnico e checklist C16](C16_RESIZABLE_INVENTORY_LOOT_SCROLL.md)

---

## C15 — implementação para homologação (01/11/2026)

- [x] C14 homologada (8/8) e [PR #120](https://github.com/richzago/ZagoQuest/pull/120) integrada na `dev` (`4af9cd1`).
- [x] Criada branch `feature/c15-ground-persistence-bag-transfer-area-loot` e [PR #121](https://github.com/richzago/ZagoQuest/pull/121) Draft.
- [x] Persistência e restauração PostgreSQL do chão com UUID/árvore de Bags; migration segura para base de teste e criação não destrutiva na base existente.
- [x] Transferência server-authoritative entre Bags com ciclo/ownership/slots/UUID e drag do Unity para Bag filha.
- [x] Wheel e scrollbar puxável em Backpack/Loot, sem interceptar slots.
- [x] Shift+L autoloot na box 3×3 sem abrir corpse, elegível pelo maior hit único efetivo registrado.
- [ ] **Homologação Unity C15 parcial — 6/8 cenários aprovados pelo usuário (01/11/2026).** Aprovados: persistência de itens/Bag com UUID após restart normal do Node; recolhimento sem duplicação; transferência direta básica para Bag filha; Shift+L sem janela aberta em box 3×3; cenário multiplayer com maior hit individual; regressões CAP/F10/1280×720/1920×1080/NPC/pesca/logout.
- [ ] **Pendente P1 — testes negativos de transferências entre Bags:** ciclos (Bag dentro dela mesma/descendente), destino sem slots e UUID inexistente/alheio, garantindo que não haja alteração de quantidade, UUID ou conteúdo nem em origem nem em destino. Testes Node anteriores NÃO substituem confirmação no Unity.
- [ ] **Pendente P2 — ergonomia de scroll Backpack e Loot:** roda do mouse, arrastar lentamente o puxador vertical, primeiro e último item clicáveis com listas suficientemente longas, inclusive nas resoluções/escalas informadas. Ainda não testado; não classificar como bug até tentativa.
- [ ] Merge PR #121 condicionado à conclusão do QA e autorização explícita, mantendo OPEN/DRAFT.
- [x] [CI #41335350708](https://github.com/richzago/ZagoQuest/actions/runs/41335350708): 595/595 testes no Ubuntu e Windows, build TypeScript e integração PostgreSQL aprovados; Unity C# e Play Mode ainda pendentes.
- [ ] Não realizar merge C15 sem aprovação.
- [ ] Mitigar risco de crash abrupto entre save de jogador e snapshot de chão em etapa de transação SQL conjunta.

[Documentação C15](C15_GROUND_BAG_TRANSFER_AUTOLOOT.md)

---

## C14 — desenvolvimento em branch isolada (01/11/2026)

- [x] C13: [PR #119](https://github.com/richzago/ZagoQuest/pull/119) **MERGED na dev** (commit `8dba71dc`) após 8/8 testes Unity.
- [x] Nova branch `feature/c14-nested-bag-cap-visible-drop` criada a partir do merge; [PR #120](https://github.com/richzago/ZagoQuest/pull/120) **DRAFT**, sem merge.
- [x] Bag recolhida do chão mantém UUID/filhos, valida estado/peso e abre por clique direito ou duplo clique.
- [x] CAP por peso configurável em JSON, com equipamentos e árvores de Bags; envia snapshot para HUD abaixo de equipamentos, inclusive em 720p/F10.
- [x] Drop em janela autoritativa 8×6 tiles, dentro da câmera do Unity, destino walkable, livre e com linha de visão; NPC/cadáver continuam acessíveis a 2 tiles.
- [x] Testes automatizados C14 para ciclo Bag antiga→chão→nova Bag, CAP, loot/bag pesada, LOS, HUD.
- [x] **Homologação manual Unity C14 concluída em 01/11/2026 — 8/8 aprovados conforme relato do usuário:** Bag antiga com itens→chão→nova Bag→recolher→abrir por clique direito/duplo; UUIDs e conteúdos independentes; CAP insuficiente em coleta/compra/loot sem perda ou duplicação; troca de equipamento no CAP cheio; drops próximos e distantes dentro do limite visual; bloqueio em paredes/água/tiles ocupados; HUD em 1280×720/1920×1080 e F10 100/115/130%; NPC/pesca/loot/logout e persistência no personagem sem regressão observada. Relato manual distinto da CI automatizada.
- [ ] **Aguardar autorização explícita do usuário para merge do PR #120.** QA 8/8 aprovado, mas o PR permanece aberto e Draft; não integrar automaticamente.
- [ ] Próximas fases: persistir Bags no chão após restart; arraste direto Bag↔Bag, CAP por vocação e regras de áreas especiais Tiled.

[Documento C14](C14_NESTED_BAG_CAP_VISIBLE_DROP.md)

---

## C13 — regressão de payload opcional e geometria de loot (01/11/2026)

- [x] Inspeção comparativa da branch com `dev`: C11 acrescentou `instanceId` opcional e cliente usa `JsonUtility.ToJson`.
- [x] DTOs separados com/sem UUID; Zod strict preservado, fromEquipment preservado.
- [x] Raiz de Loot passa a usar âncoras verticais coerentes com lootHeight (sem ampliar window).
- [x] LootItemSlot.OnEndDrag reusa filtro de UI visível.
- [x] Seis warnings obsoletos de TMP/FindObjectsByType tratados nos arquivos informados.
- [x] CI C13 [#41329598547](https://github.com/richzago/ZagoQuest/actions/runs/41329598547): 581/581 Ubuntu e Windows, build, PostgreSQL e smoke/dist aprovados. Não compila C# Unity.
- [x] C13 homologada no Unity pelo usuário em 01/11/2026 (8/8): ausência dos seis CS0618; Bag equipada e item da Bag → chão/recolher; Bag aninhada com UUID; loot individual 1/2/3, loot→Bag/chão e Shift+L; NPC/logout/movimento; 1280×720/1920×1080, F10 100/115/130. Resultado informado pelo usuário, distinto da CI Node.
- [x] C14 implementa limite de drop visível + terreno/LOS, ainda pendente de homologação Unity.
- [x] PR #119 homologado e integrado à dev em 01/11/2026, com autorização explícita do usuário.

# ZagoQuest — Auditoria viva do cliente Unity (C0–C8)

> **Atualização C11 (01/11/2026):** a especificação vigente da interação NPC, loot por distância, **Shift+L**, múltiplas Bags com UUID individuais na UI e tema original **Obsidian & Bronze** está em [C11_NESTED_BAGS_NPC_LOOT_OBSIDIAN.md](C11_NESTED_BAGS_NPC_LOOT_OBSIDIAN.md). Atalhos e detalhes de layout abaixo podem representar a etapa C10 anterior. **CAP por peso ainda não está implementado**, apenas limites por slots. PR #119 permanece Draft, sem merge.


> **C10 atualizado (01/11/2026):** a arquitetura C9 de inventário único foi substituída por **Bags com instâncias/UUID e conteúdo persistente próprio**, Merchant requer Bag para poções e Take All usa **Shift+E**. A sidebar agora é configurável via engrenagem (colunas 0–3 esquerda e 1–3 direita) e tem dimensões menores. As descrições e atalhos C9 abaixo são históricos: **a especificação vigente é [C10_INDIVIDUAL_BAGS_CLIENT_SETTINGS.md](C10_INDIVIDUAL_BAGS_CLIENT_SETTINGS.md)**. PR #119 continua em Draft, sem merge.


> **C9 — revisão crítica dos testes do usuário (P0/P1):** sequência drop/ground pickup da Bag não podia terminar sem outra bolsa, e o mesmo itemId de equipado/inventário podia derrubar cópia errada. Corrigidos com bootstrap de Bag do chão, `fromEquipment` explícito e validação Zod; ItemName UI sem raycasts e NPC ganha precedência sobre item no mesmo tile. Adicionado drag `corpse → chão` autoritativo, mais compacto Bag(142px)/Loot(176px), linhas 62/36px, scroll 9–10 e histórico LRU de quatro cadáveres. [Diagnóstico + QA](C9_CRITICAL_HOMOLOGATION_FIXES.md). **PR #119 Draft, SEM MERGE; CI Node não executa Unity.**


> **UI 2B — Mochila + Loot na área dinâmica (NOVO PR DRAFT):** branch `feature/client-ui-sidebar-dynamic-loot-backpack-2b` nasce de `dev` após merges homologados #115 `9e4ab23` e #116 `913bd49`. Reparenta instâncias REAIS `InventoryPanel` e `LootPanel` para `SidebarDynamicHost`, abas exclusivas `MOCHILA` e `LOOT`, scroll vertical, duas colunas de inventário, seleção de múltiplas linhas e Take All do servidor. **Nenhum sistema de backpacks múltiplas existe ainda no Node**; aqui MOCHILA = inventário atual. Sem mudança de gameplay, camera, `TargetSelector/IsPointerOverUi`, loot wire protocol ou Tiled. [Documentação, riscos e QA Unity](CLIENT_UI_SIDEBAR_DYNAMIC_2B.md). PR ainda requer homologação visual e autorização de merge.

> **Correção de destino solicitada pelo usuário:** usuário esclareceu que integração anterior deveria ser na `dev`, **não na `main`**. `main` foi restaurada exatamente à sua ponta anterior `cf0093b`; `dev` mantém **somente** os PRs #115 e #116 em `913bd49`; a nova UI 2B tem base `dev`. A sincronização PR #117 permanece no histórico de GitHub como já aprovada, mas a referência `main` foi explicitamente restaurada, sem código novo nela. Não repetir promoção para `main` sem nova autorização explícita.


> **UI 2A — viewport jogável ao lado da sidebar, EM QA:** o usuário homologou os testes anteriores, mas apontou bug crítico: a sidebar encobre a água a leste porque a `Main Camera` ainda renderiza na tela inteira. Nova correção **apenas no PR #116/Draft**: `C8PlayfieldViewport` (adicionado pelo `NetworkManager`) recorta a câmera existente pela borda em pixels da sidebar, recalcula aspecto, respeita F10 e restaura viewport no logout; sem criar outra câmera, sem tocar no Tiled, no `CameraFollow`, em `TargetSelector/IsPointerOverUi` ou lógica Node. Card Equipamentos 290→265 (compacto 285→260) e 10 slots 52→50, com autosizing. **Sem merge até o usuário testar água da direita, mapa único, zoom, clicks e todas resoluções.** [Checklist detalhado](CLIENT_UI_SIDEBAR_EQUIPMENT_2A.md).


> **UI 2A refinamento (31/10/2026) — mesmo PR #116/Draft:** feedback do usuário após Play Mode: remover título duplo (raiz confirmada `EquipmentPanel/Equipaments` de `scenebasic.unity`), diminuir card e slots com cuidado para nomes, minimapa circular, sidebar full bleed sem espaços topo/base/direita, retirar textos de arrastar, seis pictogramas em acesso rápido (sem siglas), ocultar painel de pesca mas preservar tecla R, adicionar nível real Fishing ao Status via campo aditivo `playerStats.fishingLevel`. PR #116 permanece sobre branch #115; `TargetSelector.cs`/`IsPointerOverUi` não alterados. Documentação e QA em `docs/CLIENT_UI_SIDEBAR_EQUIPMENT_2A.md`. **Sem merge ou avanço para 2B sem homologação e autorização do usuário.**


> **UI 2A — equipamentos na sidebar, HOMOLOGAÇÃO PENDENTE:** branch `feature/client-ui-sidebar-equipment-2a` deriva da branch **ainda não integrada** `feature/client-ui-sidebar-step1` (PR #115). Quatro zonas nesta ordem: minimapa futuro, **EquipmentPanel original reparentado com os 10 slots**, ícones de configuração futuros e `SidebarDynamicHost` preparado (loot/backpack ainda NÃO redirecionados). Visual Tibia moderno `#121B27`, `#1D2938`, `#AF8B50`. Proteção crítica: `TargetSelector.cs` e `IsPointerOverUi` INALTERADOS, Canvas raiz sem Image, só superfícies opacas/slots legítimos com raycast; sorting 110 acima da HUD antiga para permitir drag/drop. Zero mudanças de pesca, servidor, câmera e cena. [Auditoria específica](CLIENT_UI_SIDEBAR_EQUIPMENT_2A.md). **Nenhum merge à `dev` ou início de UI 2B antes de testes Unity e aprovação explícita**.


> **UI incremental pós-hotfix (31/10/2026):** o usuário homologou em Unity o [PR #114](https://github.com/richzago/ZagoQuest/pull/114), que foi integrado na `dev` com merge `911cc8e`. Iniciada SOMENTE a etapa **1/4 — sidebar independente** em `feature/client-ui-sidebar-step1` (ainda não integrada). O plano obrigatório é **1 sidebar → 2 encaixe dos painéis → 3 redimensionamento vertical → 4 câmera**, um PR isolado por etapa, com teste visual Unity e sinal verde do usuário ANTES de qualquer próximo passo/merge. O `IsPointerOverUi` de #114 é protegido; sem Image transparente fullscreen com raycast, sem changes de pesca/gameplay. Ver `docs/CLIENT_UI_SIDEBAR_INCREMENTAL.md`.


> **Revisão da C7-CLICK (31/10/2026):** primeira tentativa do PR #114 não corrigiu os cliques. Comparação dos PRs #109/#110 revelou que o #110 introduziu `EventSystem.RaycastAll` com bloqueio indiscriminado de todos Graphics ScreenSpace, incluindo Images totalmente transparentes que já existiam em `scenebasic.unity` (`ButtomLeft` 1300×210, `InventoryManager`, `LootPanel`). Revisão no mesmo PR #114 agora ignora UI decorativa invisível, mas preserva o bloqueio de janelas visíveis, e restaura o toggle Tibia-style: **2º clique no monstro interrompe**. Verificar detalhes/QA C7-CLICK-01–14 em `docs/CLIENT_C7_UX_VISUAL_AUDIT.md`. **PR #114 ainda DRAFT, sem merge**; testes Unity e aprovação do usuário obrigatórios.


> **Hotfix isolado pós-rollback — ataque/loot por clique (31/10/2026):** a base C7 restaurada no PR #113 foi testada pelo usuário, que relatou mapa/janelas quase normais, porém intermitência no clique para iniciar auto attack e abrir corpse. Branch independente `fix/client-c7-combat-loot-click-reliability` criada para corrigir `TargetSelector`, com QA manual C7-CLICK-01–12 em `docs/CLIENT_C7_UX_VISUAL_AUDIT.md`. **Proibido merge automático antes do aceite explícito do usuário via Unity.** UI/dock e pesca não fazem parte deste hotfix; CR8 e reimplementação de layout ficam para depois da homologação.


> **Marco de recuperação (31/10/2026): ROLLBACK DA C7.1.** Após regressões graves no Play Mode (janelas sobrepostas e cantos de mapa com artefatos), a `dev` deve voltar à árvore de código do [PR #110](https://github.com/richzago/ZagoQuest/pull/110), commit `ce506b69756124444a43e8ae03444187da8b396a`, revertendo inteiramente o [PR #111](https://github.com/richzago/ZagoQuest/pull/111) sem reescrever histórico. O PR #112 não integra a solução. **C7.1 cancelada na base atual; CR8 bloqueada.** Retornos da C7.1 (isWater Tiled, vara Weapon e isca Useful, docking e Camera.rect) permanecem como requisitos para implementação futura, não como funcionalidades entregues. Próximo marco: homologar a base restaurada no Unity Editor + build Windows; **somente depois criar uma branch nova** para o layout desejado e outra etapa de pesca, com testes e revisão visual antes de qualquer merge. As seções históricas anteriores documentam etapas passadas e não substituem este status.


**Estado atualizado (31/10/2026): C0/C1 CONCLUÍDAS; C2 aceita funcionalmente; C3 CONCLUÍDA/HOMOLOGADA; C4 CONCLUÍDA/HOMOLOGADA (10/10 Unity); C5 aceita funcionalmente; C6 INTEGRADA PARCIALMENTE (#100/#101/#102) com P1 de drop distante/duplo EndDrag em correção e QA Unity pendente; C7 iniciará após correção do bloqueador, C8 futura.**
**Branch de referência:** `dev` — preservar `main`.
**Notion:** [Auditoria viva do cliente Unity — roteiro C0–C8](https://app.notion.com/p/40aec07d7c4f818eac62d7d6a2b2d933).

## 1. Contexto e objetivo

O escopo de **implementação e regressão automatizada do backend** está encerrado na `dev`, com `InitialSchema1793400000000`, documentação PostgreSQL, REST/WS autenticados e CI Windows/Linux/PG. O desenvolvedor confirmou a sequência **database → contas → personagens → guilda** e posteriormente homologou no Unity Editor + build Windows as fases C0–C4, incluindo dois clientes Alfa/Beta, reconexão, exclusividade de conta, combate e respawn. A homologação de **release E2E da C8**, com queda prolongada do servidor/carga exploratória, permanece independente; os testes realizados não substituem C8.

**Não declarar Fase 8 integralmente homologada** até completar as verificações locais aplicáveis. Ela permanece como um conjunto de critérios de aceitação dentro do trabalho C0–C8 do cliente, sem confundir pendência de integração com falha já comprovada.

### Referências

- [Fase 8 — matriz de aceitação](PHASE8_FINAL_VALIDATION.md)
- [Guia de PostgreSQL e API no Windows](PHASE8_POSTGRES_WINDOWS_QA.md)
- [Contratos Unity / Networking](PHASE5_NETWORK_MATRIX_UNITY_QA.md)
- [WebSocket autenticado](PHASE5_AUTHENTICATED_SESSIONS.md)
- [Notion — checklist backend](https://app.notion.com/p/409ec07d7c4f810185b9daace1ebd3cf)
- [Notion — auditoria cliente](https://app.notion.com/p/40aec07d7c4f818eac62d7d6a2b2d933)

## 2. Regra metodológica obrigatória

Para cada fase: **Entender → Identificar → Priorizar → Corrigir → Testar → Documentar → Integrar**.

1. Revisar **código atual na `dev`** e a configuração de cena/Inspector; não presumir arquivos congelados.
2. Classificar cada achado como **BUG COMPROVADO**, **RISCO A VERIFICAR**, **DÍVIDA TÉCNICA**, **MELHORIA OPCIONAL** ou **DECISÃO DE DESIGN**. P0: perda de dados e falha de isolamento; P1: jogo/login essencial quebrado; P2: UX; P3: polimento opcional.
3. Abrir PR pequeno a partir da `dev`, contendo reprodução, diferença esperada, riscos para contrato Node/Unity, testes e manual de homologação quando necessário.
4. A CI atual roda TypeScript e PostgreSQL; **não compila nem inicia Unity**. Testes C#/Play Mode, prefabs, assets e duas janelas pertencem à homologação do desenvolvedor.
5. Merge somente após validação adequada; manter `main` intocada. Atualizar Notion + documentação GitHub + roteiro local sempre que houver alteração relevante.
6. Se a funcionalidade visual não existe, registrar **SEM UI**; não confundir com bug do servidor. Novos sistemas de gameplay não são pré-requisitos da auditoria.

## 3. Inventário inicial do cliente versionado

| Área | Arquivos de entrada | Verificação inicial |
| --- | --- | --- |
| Network | `Client/Assets/Resources/Scripts/Networking/NetworkManager.cs`, `SessionLoginDebugUI.cs`, Handlers, Senders, Messages, Context | Autenticação, fila/dispatcher, reconnect, contratos de payload |
| Mapa | `World/TiledMapRenderer.cs`, `TiledData.cs` | Camadas, sprites/GIDs, coordenadas, colisão, Assets/Resources |
| Player | `Player/PlayerController.cs` | WASD e diagonais, ACK de movimento, auto-follow, colisão/servidor autoritativo |
| Entidades | `Managers/EntityManager.cs`, `Monsters/*`, `NPC/*`, `Combat/*` | Spawn/despawn, corpse, item on ground, target, hp/nameplate |
| UI | `UI/LootUI.cs`, `InventoryUI.cs`, `EquipmentUI.cs`, `BankUI.cs`, `ShopUI.cs`, `ChatUI.cs`, `PlayerHUD.cs` | Consistência visual vs estado Node, eventos/cliques, mensagens |
| Core | `Core/GameManager.cs`, `CameraFollow.cs` | Lifecycle, singleton, cena, câmera e ordem de inicialização |

Versão editor no repositório: `Client/ProjectSettings/ProjectVersion.txt` = **6000.4.10f1**. Confirmar a versão usada localmente.

A lista é uma entrada para revisão, **não uma auditoria que já comprovou defeitos**. Há relatos prévios de dificuldade de selecionar itens adicionais na Loot UI e ausência de interface visual para pesca: reproduzir antes de classificar.

## 4. Fases de revisão do cliente

| Fase | Escopo | Saída esperada |
| --- | --- | --- |
| **C0 — Baseline** | Unity Editor, pacotes, cenas, input, prefabs, Play Mode, build local e Console | Projeto compila e cena principal abre sem erro impeditivo |
| **C1 — World/Tiled** | tilemaps, tilesets, flipped GIDs, layers, colisão, coordenadas e prefabs | Mapa desenhado e compatível com world authoritative |
| **C2 — Lifecycle/Entities** | Managers, singletons, spawns, snapshots, corpse/loot, cleanup em reconnect | Entidades não somem, duplicam ou vazam entre sessões |
| **C3 — Network/Auth** | WS, login REST, JWT, personagem por UUID, Handlers/Senders, reconnect | Duas contas isoladas, mensagens/erros consistentes |
| **C4 — Player/Combat** | Input, movimento, target, auto-follow, dano/HP, morte e respawn | Inputs e efeitos visuais batem com decisão do servidor |
| **C5 — NPC/World** | NPC merchant/banker, monstros, interação, loot, cadáveres | Diálogos/transações/loot coerentes com Node |
| **C6 — Inventory/UI** | Inventário, equipamentos, banco, loja, HUD e chat | UI atualiza, fecha e trata estados vazios sem dados fantasma |
| **C7 — UX/Funcionalidades visuais** | Câmera, legibilidade, telas, polimento, pesca (se houver escopo de implementação) | UX e backlog separados dos P0/P1 |
| **C8 — E2E/Release decision** | 2 Unity clients, reconnect, restart, persistência, carga exploratória e limpeza | Evidência de homologação real; produção avaliada separadamente |

### C0 → C3: primeira bateria prática (registro histórico; aceite de C0–C4 resumido ao final)

- [ ] Atualizar `dev`; abrir o projeto no Unity e identificar erros de importação/compilação.
- [ ] Conectar com `NetworkManager.requireAuthenticatedSession=true` e `WS_AUTH_REQUIRED=true` no Node, apontando para ambiente **local e descartável**.
- [ ] `SessionLoginDebugUI`: login em contas A/B distintas e seleção do UUID correto.
- [ ] Rodar Editor + build Windows (ou dois builds), verificar que ambas as sessões controlam somente seu personagem.
- [ ] Bloquear duplicação da mesma sessão e acesso a personagem de conta diferente; não revelar tokens.
- [ ] Verificar reentrada, reconexão, snapshot e posições sem NPCs/monstros fantasmas.
- [ ] Desligar Node com jogadores conectados e validar recarga/persistência no PostgreSQL de teste.

**Nota histórica:** essa lista registra o plano inicial e não substitui o aceite posterior. Em 31/10/2026 o desenvolvedor homologou Editor+Windows Alfa/Beta, sessão por conta/UUID, combate, HUD e respawn. A verificação de queda prolongada do Node e release completo continua na C8.

## 5. Registro de cada teste / PR

```text
FASE Cx / CASO:
SHA DEV:
VERSÃO UNITY / AMBIENTE:
ARQUIVOS / CONTRATO:
CLASSIFICAÇÃO:
AÇÃO E ESPERADO:
OBSERVADO:
TESTE AUTOMATIZADO:
PLAY MODE / BUILD UNITY:
POSTGRESQL (somente zagoquest_test):
RESULTADO: PASSOU / FALHOU / SEM UI / BLOQUEADO
PR / MERGE / PRÓXIMA AÇÃO:
```

**Governança:** revisar `dev`, documentar achado, branch + PR menor possível, CI, homologação Unity quando afeta cena/cliente, merge e atualização Notion. Não usar `npm run test:pg` nem `npm run smoke:dist` contra o banco local. Não excluir artefatos existentes e não usar `DB_SYNCHRONIZE=true` em database com dados a preservar.

## Atualização C3 → C4 (31/10/2026)

**Relato novo:** o segundo Unity não entra com o mesmo personagem e mostra somente `Handshake WebSocket concluído`, sem explicar a recusa. Isso é apenas a abertura do transporte; o Node recusa duplicatas com 1008, mas o Unity não recebe a reason textual do NativeWebSocket.

**C3 ajuste de feedback:** o servidor manda `authRejected` com código de domínio `alreadyOnline` antes de fechar com 1008; UI QA mostra aviso claro de personagem conectado, sem expor JWT/UUID da sessão ativa. O segundo socket permanece rejeitado e a primeira sessão não é afetada. QA específico ainda precisa ser feito no Unity após integrar o PR.

**Sequência confirmada pelo desenvolvedor:** após o ajuste do login duplicado, iniciar **C4 — Player/Combat** (input, movimento, target/auto-follow, dano/HP, morte e respawn). **Não pular para C5**; NPC/World será revisado depois da C4. C8 permanece validação final independente.

## C3 encerrada e auditoria C4 ampliada — 31/10/2026

**Aceite definitivo C3:** usuário informou que tudo funciona e que já testou com êxito a nova regra de apenas um personagem conectado por conta, após PR #95. A C3 está oficialmente HOMOLOGADA; não confundir com o escopo mais amplo da C8 (escala, restarts prolongados, release).

**C4 atual:** já corrigidos, no PR #94, ciclo de vida das 8 InputActions do Player e envio de comandos sem conexão em TargetSelector. QA funcional anterior de combate/Alfa/Beta passou; revisão técnica aprofundada segue aberta. PR específico seguinte cobre dois bugs C4: PlayerHUD conserva singleton estático depois de OnDestroy e TargetSelector envia STOP redundante/perde seleção anterior quando o ID do novo monstro desapareceu antes de selecionar. Correções locais e teste de contrato, sem mudar Node autoritativo, cooldown, distância de ataque, Tiled ou dados PostgreSQL.

**Cobertura detalhada de C4:** Node MovementSystem, move.handler, PlayerAttackSystem, attack.handler, gameStarter autoattack, CombatSystem, CombatEventBridge, DeathSystem, PlayerStatsSender; Unity PlayerController, TargetSelector, PlayerHUD, PositionHandler, PlayerStatsHandler, DamageHandler, InitHandler, AutoAttackStoppedHandler, EntityManager e TargetOutline. Matriz e scripts de QA descritos em [CLIENT_C4_PLAYER_COMBAT_AUDIT.md](CLIENT_C4_PLAYER_COMBAT_AUDIT.md). Fechamento de C4 exige QA local desta última alteração + validação da matriz Player/Combat. Não antecipar C5.

## Fechamento definitivo C4 / Transição C5 — aceite do desenvolvedor (31/10/2026)

**Decisão:** **C4 Player/Combat CONCLUÍDA e HOMOLOGADA**, sem alterações adicionais necessárias. O desenvolvedor enviou **10/10 resultados [OK]**, explicitamente após os PRs #94 e #96:

1. Alfa no Unity Editor e Beta na build Windows, personagens/posições corretos.
2. WASD, Q/E/Z/C, colisão e troca rápida de direção.
3. Chat com digitação sem disparar movimento.
4. Seleção distante e aproximação antes de causar dano.
5. Troca de alvo válido, cancelamento e desaparecimento de monstro.
6. Goblin foge com HP baixo; auto-follow e autoattack retomam quando recupera alcance.
7. Barra HP do Goblin, dano flutuante, HP e XP do jogador.
8. Morte de Goblin gera cadáver único, loot e respawn sem seleção fantasma.
9. Morte de Beta restaura HP, aplica penalidade de XP e respawna no Tiled (ou tile livre próximo).
10. Três reentradas no Play Mode: HUD/input corretos; sem `MissingReferenceException` nem `NullReferenceException`.

**Evidência de código e CI:** PR [#94](https://github.com/richzago/ZagoQuest/pull/94) protege InputActions e ataques/loot sem sessão; PR [#96](https://github.com/richzago/ZagoQuest/pull/96) corrige singleton PlayerHUD e troca segura de alvo, merge commit `d150cde61bfd7655f2dc5dcafbe88284e9c04145`. [CI do #96](https://github.com/richzago/ZagoQuest/actions/runs/41223127595) e [CI pós-merge](https://github.com/richzago/ZagoQuest/actions/runs/41223282123) **PASS Windows/Linux/PostgreSQL**. Código de gameplay do Node, Tiled, PostgreSQL e `main` não foram alterados no fechamento.

**Critério de conclusão atingido:** matriz de movimento, target, auto-follow, dano/HP, XP, morte/respawn e lifecycle verificada no Editor/build, sem erro impeditivo relatado. Há limites: latência artificial extrema, carga, restart prolongado do servidor e release seguem no escopo da C8, não reabrem C4 sem falha reproduzível.

**C5 — NPC/World INICIADA:** [relatório específico](CLIENT_C5_NPC_WORLD_AUDIT.md). Primeira auditoria de `NpcLoader`, `NpcAI`, `MonsterAI`, `NpcInteractionSystem`, `ClickInteract`, handlers Shop/Bank/Loot, UI de loja/banco/loot, cadáver e AI. Separar bugs comprovados, riscos a reproduzir, diferenças de regra, melhorias UI da C6. **Não antecipar alterações no servidor ou Unity antes de testes e evidências.**

**Próxima etapa:** definir matriz C5 (NPC merchant/banker, conversa e afastamento, IA e ocupação, saque/depósito/compra com autorização, cadáver e loot em dois clientes), depois corrigir incrementalmente qualquer defeito comprovado em PR dedicado, com CI e QA local.

## C5 ampliada para UI de NPC/loot; C6 inventário/equipamentos/HUD (31/10/2026)

**Solicitação do desenvolvedor:** a C5 deverá corrigir e homologar **tanto os contratos NPC/World quanto o layout usável de Merchant/Banker e cadáver/loot**. Relato: janela de cadáver com "divs" desalinhadas, primeiro item clicável e demais quase impossíveis de selecionar; painéis NPC esteticamente inconsistentes. A **C6** ficará responsável por redesenho/organização de **InventoryUI, EquipmentUI e HUD/gameplay geral**, sem misturar as correções desta entrega.

**C5 — BUGS REAIS após inspeção de `scenebasic.unity`, prefabs e scripts:**
- Viewport do ItemContainer de loot serializado com anchors/SizeDelta zero; Content VerticalLayoutGroup não controla largura/altura; LootItemSlot TMP com raycastTarget true nos labels; dois cliques exigidos; LootUI closeButton sem referência e raiz transparente interceptando cliques.
- LootTakenHandler fechava janela para todo `lootTaken`, inclusive coleta individual, mesmo quando restavam itens e índices de loot mudavam. LootErrorHandler ignorava erros.
- ShopItemSlot_Temp.prefab root 400×300 e filhos absolutos, sem linha/layout responsivo; ShopUI com lifecycle incompleto, quantidade visual da loja ignorada ao comprar.
- Banco: saldos e botões em offsets absolutos fora de alinhamento.

**C5 — CORREÇÃO INCREMENTAL NA BRANCH:** novo helper WorldWindowLayout com scroll vertical, ContentSizeFitter/VerticalLayoutGroup, linhas com LayoutElement e rótulos sem raycast; ajuste de RectTransforms em runtime, sem mexer em arquivos .unity/.prefab; interação loot de um clique e confirmação `lootTaken` individual, preservando outros itens; mensagens de erro; Merchant/Banker alinhados e com paleta consistente. Testes de contratos C# em `clientC5NpcLootUiContracts.test.ts` integrados à CI; **Play Mode não coberto pela CI**.

**QA para fechar C5:** manter matriz de `docs/CLIENT_C5_NPC_WORLD_AUDIT.md` e acrescentar: 3+ itens de corpse acessíveis (inclusive segundo e terceiro), 4–8 itens com scroll, coleta parcial e takeAll sem duplicação, janela fechável, Merchant catálogo/quantidade/saldo/estoque, Banker saldos/campos/botões, NPCs em disputa Alfa/Beta, distância e revogação de autorização, logout/reconnect, ausência de UI fora do viewport a 1280×720/1920×1080. **Não declarar C5 encerrada até aceite explícito do desenvolvedor.**

**C6 BACKLOG DECLARADO:** estudar `InventoryUI.cs`, `EquipmentUI.cs`, `PlayerHUD.cs`, Canvas/CanvasScaler, prefabs de slots/ícones e hierarquia `scenebasic.unity`; projetar layout consistente em dark fantasy legível, interações equip/unequip/drop, hotkeys e estados vazios, coordenadas/âncoras/scroll, responsividade 16:9. Testes de UI no Unity obrigatórios. Não alterar Server Inventory/Equipment sem defeito comprovado.

## Transição C5 → C6 — refinamentos finais aceitos (31/10/2026)

O desenvolvedor informou que os testes funcionais e visuais da C5 após o PR #98 deram certo **exceto dois refinamentos de design**: identificar `Saldo no banco` versus `Ouro em mãos` na tela Banker e **remover limites de estoque** do Merchant tanto do backend quanto da UI. O ajuste está no PR incremental `fix/c5-bank-labels-merchant-unlimited`, com economia segura preservada e testes completos. A primeira homologação C5 foi informada como satisfatória; os dois itens finais só ficam formalmente homologados após QA Unity.

**C6 — Inventory/Equipment/HUD autorizada a iniciar:** separar dois eixos de investigação: (1) bugs de funcionalidade/lifecycle reais; (2) layout e legibilidade em Unity. Arquivos iniciais: `InventoryUI.cs`, `InventorySlot.cs`, `EquipmentUI.cs`, `EquipmentSlotUI.cs`, `PlayerHUD.cs`, `DragDropManager.cs`, `ZagoQuestUiTheme.cs`, `scenebasic.unity` e prefabs InventorySlot/ItemButton. Preservar transações autoritativas do Node (inventário/equip/drop) e os fluxos Player/Combat aprovados. Não confundir conteúdo visual ruim com dados inválidos. Criar doc `CLIENT_C6_INVENTORY_EQUIPMENT_HUD_AUDIT.md` e PR próprio, com QA por Editor+Windows antes de fechar a fase.


## 31/10/2026 — C6 redesign visual 1 (PR draft)

Branch feat/client-c6-inventory-equipment-visual criada após PR #100; grade rolável 3 colunas, slots e fontes legíveis, painéis lado a lado, equipamento corporal, fallback sem alocação de sprite e drop para área vazia do inventário. Contratos continuam sob autoridade Node. CI estática e QA Unity Editor+Windows pendentes: NÃO declarar C6 homologada; não integrar à dev antes dos testes. Detalhes em CLIENT_C6_VISUAL_UI_PASS.md.


## 31/10/2026 — C6 HUD/Chat/economia: nova etapa em branch de PR

Após o PR #101 integrado na dev, o desenvolvedor confirmou que a interface está aparentemente correta e pediu continuação da revisão integral de InventoryUI, EquipmentUI, LootUI, ShopUI, BankUI, PlayerHUD e ChatUI.

Branch de trabalho: feat/client-c6-hud-chat-hardening. Ajustes: Enter/onSubmit não envia duas mensagens; mouse ativa o estado do chat, listeners são removidos e histórico é limitado; chat e painel de barras posicionados com layout de runtime; PlayerHUD usa clamp somente visual, distingue XP de nível/XP total e FPS amostrado; BankUI impede duas transferências antes de bankResult (sem alterar saldos localmente). Testes C6 estáticos ampliados. Código e matriz de QA no relatório CLIENT_C6_INVENTORY_EQUIPMENT_HUD_AUDIT.md, seção 7.

Não transformar testes automatizados de Node em alegação de compilação C# ou QA visual. A C6 só será HOMOLOGADA após testes Editor + Windows nas duas resoluções, inventário/equip, Chat Enter/tecla I, banco/loja/loot e dois clientes. C5 recebeu aceite positivo do usuário; últimos detalhes do #99 considerados aparentemente corretos conforme relato, sem inventar logs. Main intacta.

**Orientação local permanente:** antes de atualizar dev, fechar Unity e usar git stash push -u -m "backup Unity antes de atualizar C6"; depois git fetch origin, git switch dev, git pull --ff-only origin dev. Revisar stash list; NÃO dar stash pop automaticamente.


## C6 integrada — PR #102 e resultado da CI (31/10/2026)

[PR #102](https://github.com/richzago/ZagoQuest/pull/102) MERGED na dev em 26526d3c38623113402332e62b3f1ba3aa4ffd90, após [CI pré-merge #41230928166](https://github.com/richzago/ZagoQuest/actions/runs/41230928166) PASS em Windows, Linux e PostgreSQL. Foram 463/463 testes Node aprovados; contratos C# são estáticos e não provam compilação Unity nem layout visual. [CI push da dev #41231055822](https://github.com/richzago/ZagoQuest/actions/runs/41231055822) iniciada, aguardar conclusão pós-merge.

Escopo: C6 inventário/equipamentos (#100/#101), chat/HUD e estados vazios, prevenção de duplo Enter, bloqueio de transferência bancária e regressão C4 (#102). C5 manteve aceite reportado. C6 não está HOMOLOGADA sem roteiro dos 13 casos Unity no relatório CLIENT_C6_INVENTORY_EQUIPMENT_HUD_AUDIT.md (Editor + Windows, duas resoluções, dois clientes, Enter/foco/atalho, XP/HP, drag/drop, loot/banco/loja). Main intacta.

Para atualizar localmente sem perder dados: fechar Unity; git status; git stash push -u -m "backup Unity antes de atualizar C6"; git fetch origin; git switch dev; git pull --ff-only origin dev; git log -1 --oneline; git status; git stash list. Nunca executar stash pop automaticamente.


## C6 P1 bloqueador para C7 — drag ao chão distante (31/10/2026)

Relato: EndDrag duplicado no InventorySlot/EquipmentSlot e `dropError` do Node para distância ou destino inválido ao arrastar bone_sword. Diagnóstico confirmado por inspeção: DropOnGround já faz EndDrag; slots repetem chamada; Unity não valida distância; Node Manhattan <=2 e floor tile antes de remover item. Correção incremental em branch `fix/client-c6-drag-ground-range`: usar posição confirmada do PlayerController, FloorToInt, checar alcance/rede e coordenadas finitas, cancelar solicitação distante com mensagem, limpar drag uma única vez, tratar erro autoritativo como warning. Testes de C6 estáticos e novos casos de servidor em economy.test.ts. Matriz QA de dez casos D1–D10 na seção 9 de CLIENT_C6_INVENTORY_EQUIPMENT_HUD_AUDIT.md.

**Sequência:** CI PR Windows/Linux/PostgreSQL → merge na `dev` sem tocar main → reteste local Unity Editor/build dos casos críticos → somente com D1–D10 aprovados homologar C6 e avançar na implementação C7. A preparação de escopo e checklist da C7 pode começar em paralelo, mas não confundir planejamento com aceite Unity.

Comandos locais: fechar Unity; git status; git stash push -u -m "backup Unity antes do fix C6 drop"; git fetch origin; git switch dev; git pull --ff-only origin dev; git log -1 --oneline; git status; git stash list. Nunca aplicar stash pop automaticamente.


## Transição C6 P1 → C7 (31/10/2026)

[PR #104](https://github.com/richzago/ZagoQuest/pull/104) **MERGED na dev** em `2626464c2a68dc6af6ce1d1b39429ab20867d1d3`, com CI pré-merge [#41231942100](https://github.com/richzago/ZagoQuest/actions/runs/41231942100) PASS Windows/Linux/PostgreSQL, **467/467 testes**. O cliente agora bloqueia drop fora da distância Manhattan 2, usa posição confirmada do PlayerController e termina arraste uma única vez; servidor continua autoritativo. A CI após merge [#41232067625](https://github.com/richzago/ZagoQuest/actions/runs/41232067625) foi iniciada; conferir conclusão. **C6 ainda exige o reteste Unity D1–D10 do relatório C6 seção 9**, portanto não declarar homologação.

**C7 INICIADA como auditoria, sem implementação visual presumida:** novo [CLIENT_C7_UX_VISUAL_AUDIT.md](CLIENT_C7_UX_VISUAL_AUDIT.md) define áreas C7-A câmera/viewport, C7-B input/target sobre UI, C7-C legibilidade, C7-D Tiled/sprites/pesca (SEM UI se ausente), C7-E performance/reentrada e 12 testes C7-01–12. Riscos iniciais por inspeção: CameraFollow.Lerp sem deltaTime; TargetSelector.OverlapCircleAll em transform do seletor, possível centro errado; clique Physics2D em UI. Não mudar combate sem reprodução e preservar Node autoritativo. C8 continua separada.

Comandos locais: fechar Unity; git status; git stash push -u -m "backup Unity antes do C7"; git fetch origin; git switch dev; git pull --ff-only origin dev; git log -1 --oneline; git status; git stash list. Não aplicar stash pop automaticamente.


## 31/10/2026 — C6 reaberta: HUD, mana, equipamentos e food antes da C7

O desenvolvedor pediu compactar o HUD (nome/nivel/HP vermelho/mana azul, sem XP visível no HUD; Status/P mantém XP), fixar equipamentos no centro direito liberando topo direito para minimapa futuro e fazer alimentos regenerarem HP e mana periodicamente. Por inspeção, a raiz dos personagens zerados está no CharacterService criando mana/maxMana 0/0 embora Player/Vocation.NONE tenha 50/50. Consumíveis cheese/peixes não continham foodSeconds e ConditionManager só implementava DoT; criar FoodRegenerationSystem server-side com 2HP+1mana a cada 2s, saciedade max 120s, tick integrado ao gameStarter e playerStats apenas quando há mudança. Corrigir criação de personagens e migração em memória de saves legados maxMana 0 (não restaurar mana legitima 0/50). HUD pinta o Slider.fillRect efetivo e oculta XP no HUD, sem apagá-la do Status/P. Equipamentos ancorados em (1,0.5), posição (-12,0).

Relatório CLIENT_C6_INVENTORY_EQUIPMENT_HUD_AUDIT.md seção 10, QA H1–H10 e testes foodRegeneration/characterPersistence/C4/C6. Não afirmar funcionamento Unity antes de Editor + Windows build. C7 auditoria #105 preservada, mas PRs de gameplay C7 só após reteste C6. Persistência de saciedade não implementada nesta C6 (estado em memória por sessão); HP/mana persistem via autosave. Main intacta. Fechar Unity e executar git stash push -u -m "backup Unity antes do C6 HUD food" antes de fetch/switch/pull dev. Não aplicar stash pop automaticamente.

## C6 — Consumíveis: clique, uso e mana inicial relatados (31/10/2026)

Usuário relatou cheese/poções não consumidos, cheese com erro "não equipável" no Node e mana ainda zero. Log Unity prova duplo clique -> InventoryUI.OnSlotDoubleClicked -> SendEquipItem para consumable/cheese; cliques simples nas poções não tinham ação. Patch em fix/client-c6-consumables-doubleclick: duplo clique genérico e botão direito usam useItem (Node decide consumo/equipamento); inventory snapshot inclui itemType opcional vindo do ItemRegistry e clique simples esquerdo em consumable usa o item, com proteção de clique duplo; consumíveis nunca são enviados como equipItem pelo fluxo de clique. Drag equipamento continua equipItem e Node valida. Testes estáticos/clientC6 e reais foodRegeneration cobrem o protocolo e o uso.

A mana 0 pode estar persistida como estado real: CharacterService após #106 inicia 50/50 em NOVOS personagens; DatabasePersistence recupera maxMana 0 de legados e preserva mana 0 com maxMana positiva. Sem dados concretos da base NÃO classificar como bug de HUD nem redefinir mana no login. PlayerStatsHandler alerta quando receber 0/maxMana. Query SQL read-only no relatório C6 seção 11; ajuste em um personagem offline exige consentimento e backup e não é executado globalmente. Testes U1-U8 na seção 11 incluem clique simples/double/right, potions/food, item full e mana real.

C6 aguarda QA Unity; C7 segue somente auditada/documentada (#105). main intacta. Após merge fechar Unity, git stash push -u -m "backup Unity antes da correção consumíveis C6" antes de fetch/switch/pull dev. Não aplicar stash pop automaticamente.

## 31/10/2026 — C6 U1–U8: novas ressalvas; U9–U17 antes da C7

QA do usuário: food funciona mas come sem capacidade; potions OK em mana/HP baixos; U4/U5 OK; bone_sword no duplo clique também equipou bone_armor; U7 usuário quer poder gastar poções mesmo cheio; U8 Status sobrepõe login. Ajustes no branch fix/client-c6-satiety-potions-single-equip-session-ui. REGRAS FOOD JSON: foodSeconds = duração; satietyPoints = ocupação de 120 pontos; regenTickSeconds, regenHpPerTick, regenManaPerTick = cura fraca e configurável. 6 cheese x20 pontos, 3 meat x40; porções sequenciais sem aumentar ganho das anteriores. Dados ajustados em server/src/data/items/consumable/{cheese,meat}.json e fishing/fish.json. Regen JSON de food menor que potions (50HP/30Mana instantâneos). Quando a saciedade cheia termina, pode comer de novo. Consumível com JSON incompleto ou comida que excede limite recusa SEM retirar unidade.

Poções com atributos cheios agora podem ser consumidas normalmente (gasto do jogador sem ganho); equip de bone_sword não deve equipar armor: InventoryUI desativa slots obsoletos antes de recriar e recusa duplo clique subsequente por 0.45s; confirmar em Unity. SessionLoginDebugUI oculta login quando autenticado ou reconectando, mostra apenas ícone de logout no rodapé direito; NetworkManager faz logout real (apaga credenciais e fecha WS); StatusManager ancorado no centro esquerdo, layout escuro, tecla P só autenticado e unsubscribe correto. Nenhuma mutação do main, nem de arquivos serializados Unity.

Checklist de QA U9–U17 e dados de balanceamento em docs/CLIENT_C6_INVENTORY_EQUIPMENT_HUD_AUDIT.md seção 12. C7 continua com auditoria documental #105, sem mudanças de gameplay até homologação C6. CI Node e PG exigida antes de merge; não equivale à compilação C# / Windows build. Fechar Unity e proteger alterações locais com stash -u antes do pull.

## C6 — U18–U33 (31/10/2026): equipamento/merchant/caixas/XP

- Equipamento: WS inicial não incluía equipment mesmo quando DatabasePersistence recuperava character.equipment. Agora envia equipment antes de playerStats, e EquipmentUI mantém snapshot caso chegue antes de Start mapear slots. Bone Armor aparecer após equipar Sword pode ser armadura já persistida e antes invisível. Não impor rate-limit artificial; testar com WS real.
- Logout: SessionLoginDebugUI cria Canvas UGUI C6LogoutOverlay com SAIR visível sem Hierarchy/Inspector, apaga credenciais em memória e fecha WebSocket.
- Saciedade no Status: contrato playerStats.satiety, satietyMax, foodSecondsRemaining, atualiza ao comer e após terminar efeito.
- Merchant SELL: rota WS, validação Zod estrita, sessão NPC, distância, quantidade, preços buyPrice/sellPrice JSON, proteção de saldo. UI Compra/Venda e ambos preços, sem stock. Merchant agora comercializa cheese, meat, bone_armor e peixes.
- Caixas: cabeçalho movível Chat, Status, Inventory, Equipment, Bank, Loot e Shop; posições locais persistem PlayerPrefs, clique direito no cabeçalho reseta. Redimensionamento não implementado nesta etapa.
- HUD: XP vermelha reaparece e avança por levelXp / levelXpToNext, sem mexer na autoridade do servidor.

Checklist C6 U18–U33 e limites no docs/CLIENT_C6_INVENTORY_EQUIPMENT_HUD_AUDIT.md seção 13. C6 só fecha após Unity Editor e build Windows; testes Node/PG não compilam C#. Não iniciar gameplay C7 antes de homologação. Main não modificada.

## 31/10/2026 — C7 UX/Camera/Visual Fishing: implementação para merge dev

C6 foi homologada pelo usuário. C7 auditada desde PR #105, agora implementada conforme docs/CLIENT_C7_UX_VISUAL_AUDIT.md seções 6–9. Prioridade:
- C7-A CameraFollow: suavização 30/60/120 FPS independente, zoom +/- com PlayerPrefs, clamping visual ao Tiled MapWidth/Height e snap após teleporte/respawn. TiledMapRenderer não sobrescreve ortho size da camera controlada.
- C7-B input: TargetSelector evita mirar/loot/NPC atrás de Canvas (EventSystem.RaycastAll); Espaco seleciona por distância ao PlayerController, não ao transform do próprio TargetSelector, estável por distância/ID. R, +/-, F10 respeitam chat/TMP input.
- C7-C acessibilidade/UI: C7UiAccessibility F10 escalas 100/115/130% local sem redesenhar sprites mundo; Canvas de pesca 420, logout C6 500; CanvasScaler reference 1920x1080 atual; avaliar legibilidade real 1280x720/1920x1080.
- C7-D pesca: feature visual nova, NÃO bug do backend: FishingSystem já tem vara, isca, skill, recompensa e timer. Novos comandos WS startFishing/cancelFishing (Zod estrito), packet fishingStatus, callbacks opcionais WeakMap com cancel/completion, UI automática C7FishingUI com painel, botão, estado, progresso visual e R. Só Node concede itens, tempo, skill. **isNearWater ainda usa Y>=8 simulado**; requer depois tile water Tiled autoritativo; sem bobber/linha/áudio ainda.
- C7-E regressão: novos tests/clientC7Fishing.test.ts com FakeTimers, testes clientC7UxContracts, 23 mensagens schema+handler sincronizadas; QA Unity C7-13–C7-31 e C7-01–C7-12; não confundir CI Node com compilação C# do Unity.

Classificação explícita: BUG REAL (lerp FPS, centro de alvo); RISCO (clique UI, resolução, zoom, reconnect, sorting); FEATURE (pesca cliente); DÍVIDA TÉCNICA (tiles de água, assets e acessibilidade avançada); SUGESTÃO FUTURA (minimizar/dock/resize, tooltips, bobber visual). Não reescrever backend nem mudar drop XP/gold/economia/movimento. Branch dev somente; main intocada. QA manual Unity e build Windows necessários após merge.
