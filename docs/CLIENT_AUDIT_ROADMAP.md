# ZagoQuest — Auditoria viva do cliente Unity (C0–C8)

**Estado atualizado (31/10/2026): C0/C1 CONCLUÍDAS; C2 aceita funcionalmente; C3 CONCLUÍDA/HOMOLOGADA; C4 CONCLUÍDA/HOMOLOGADA (10/10 Unity); C5 aprovada funcional e visualmente pelo desenvolvedor após PR #98, refinamentos finais Banker/Merchant no PR #99 integrado (QA local desses dois itens pendente); C6 INICIADA — baseline Inventory/Equipment e redesign HUD em auditoria (PR #100). C7/C8 futuras.**
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
