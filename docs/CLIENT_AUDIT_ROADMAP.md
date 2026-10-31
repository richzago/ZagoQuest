# ZagoQuest — Auditoria viva do cliente Unity (C0–C8)

**Estado atualizado (31/10/2026): C0 e C1 CONCLUÍDAS; C2 funcionalmente aceita; C3 CONCLUÍDA/HOMOLOGADA pelo desenvolvedor (JWT, personagem e exclusividade por conta, PR #95); C4 EM AUDITORIA MINUCIOSA após primeira bateria local aprovada e PR #94 integrado, com novo PR incremental HUD/target e QA pendente. C5 só após C4; C8 mantém homologação E2E independente.**
**Branch de referência:** `dev` — preservar `main`.
**Notion:** [Auditoria viva do cliente Unity — roteiro C0–C8](https://app.notion.com/p/40aec07d7c4f818eac62d7d6a2b2d933).

## 1. Contexto e objetivo

O escopo de **implementação e regressão automatizada do backend** está encerrado na `dev`, com `InitialSchema1793400000000`, documentação PostgreSQL, REST/WS autenticados e CI Windows/Linux/PG. O desenvolvedor relatou que os testes locais da sequência **database → contas → personagens → guilda** funcionaram em seu Windows, mas ainda não houve confirmação detalhada da bateria Unity com dois clientes, reconexão, persistência e interface.

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

### C0 → C3: primeira bateria prática

- [ ] Atualizar `dev`; abrir o projeto no Unity e identificar erros de importação/compilação.
- [ ] Conectar com `NetworkManager.requireAuthenticatedSession=true` e `WS_AUTH_REQUIRED=true` no Node, apontando para ambiente **local e descartável**.
- [ ] `SessionLoginDebugUI`: login em contas A/B distintas e seleção do UUID correto.
- [ ] Rodar Editor + build Windows (ou dois builds), verificar que ambas as sessões controlam somente seu personagem.
- [ ] Bloquear duplicação da mesma sessão e acesso a personagem de conta diferente; não revelar tokens.
- [ ] Verificar reentrada, reconexão, snapshot e posições sem NPCs/monstros fantasmas.
- [ ] Desligar Node com jogadores conectados e validar recarga/persistência no PostgreSQL de teste.

Todos os itens acima aguardam execução pelo desenvolvedor, exceto as confirmações REST/PG explicitamente registradas no documento da Fase 8.

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
