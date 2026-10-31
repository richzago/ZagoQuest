# ZagoQuest — C7: Auditoria de UX e funcionalidades visuais do cliente Unity

**Abertura técnica:** 31/10/2026  
**Base de implementação:** `dev` após C6 [PR #109](https://github.com/richzago/ZagoQuest/pull/109), commit `293c6ff88d50d1daebe60d84ba9370f8f3fe399d`.  
**Estado:** C7 implementada em branch de feature, testes Node e QA manual Unity diferenciados. A matriz C7-01–C7-12 inicial permanece útil, complementada pelos casos C7-13–C7-31 abaixo; não declarar homologação visual sem Editor/build.  
**Escopo:** câmera, legibilidade e responsividade das telas, feedback, colisão visual, foco/cursor, target, importação de sprites e funcionalidades que ainda não têm UI. C8 (E2E/release) permanece separada.

## 1. Princípios e limites

- Entender → Identificar → Priorizar → Corrigir → Testar → Documentar → Integrar. Confirmar cena e código atuais antes de cada PR.
- Preservar a autoridade do Node em dano, loot, itens, XP, NPC, movimento, tiles e economia. UI só exibe e solicita.
- Não regressar C0–C6; especialmente C4 combat/target, C5 NPC/loot e C6 drag/banco/chat.
- Manter main intacta, abrir PRs pequenos sobre dev, com testes estáticos Node + QA Editor 6000.4.10f1/build Windows. CI Node não compila nem abre Unity.
- Classificar: BUG REAL, RISCO A REPRODUZIR, DÍVIDA TÉCNICA, MELHORIA OPCIONAL, SEM UI e DECISÃO DE DESIGN. Não chamar ausência de feature de bug.

## 2. Leitura inicial do código (evidências, não aceite visual)

| Código | Achado | Tipo | Próxima investigação |
| --- | --- | --- | --- |
| Core/CameraFollow.cs | LateUpdate faz Vector3.Lerp(transform.position, target.position+offset, smoothSpeed) sem Time.deltaTime | RISCO P2 | Suavização depende de FPS e altera sensação em 30/60/120 Hz; verificar alvo, zoom ortográfico e bordas |
| Combat/TargetSelector.cs | CycleToNextMonster usa Physics2D.OverlapCircleAll(transform.position, maxTargetDistance) | RISCO P1/P2 | Se TargetSelector está fora do jogador, a busca por monstros próximos usa centro errado; inspecionar Hierarchy e reproduzir Espaço |
| Combat/TargetSelector.cs | OnMouseClick usa raycast Physics2D sem consulta explícita a EventSystem.IsPointerOverGameObject | RISCO P2 | Clicar em UI sobre monstro/cadáver pode afetar target/loot; confirmar empiricamente no Play Mode |
| World/TiledMapRenderer.cs | Importa sprites de Resources/Tilesets pelo sufixo da fatia e registra GIDs ausentes por camada | RISCO de assets | Verificar GIDs ausentes, visuais Ground/Decoration/Collision, coordenadas e descarte de tiles |
| UI/ZagoQuestUiTheme.cs | Aplica cores/Outline por nomes de objetos e altera painéis em Start | DÍVIDA TÉCNICA | Testar execução após rearranjo runtime C5/C6, sobreposições e idempotência |
| UI/PlayerHUD.cs + UI/ChatUI.cs | Painéis reposicionados em runtime, CanvasScaler 1920x1080 | RISCO visual | Validar 1280x720/1920x1080, nome longo, mensagens longas, scroll e HUD com outros painéis |
| C6 Drop/Inventory/Equipment | Drop distante agora usa posição confirmada Node e Manhattan <= 2 | DEPENDÊNCIA C6 | Executar D1–D10 antes de declarar C6 homologada; não reescrever nesta fase |
| Pesca | Desenvolvedor informou anteriormente não ter interface visual de pesca | SEM UI | Verificar contratos já existentes de fishing e decidir separadamente se entra em C7; não inventar sprites/fluxos |

## 3. Workstreams sugeridos (PRs independentes)

1. **C7-A — Camera e viewport:** ligar camera a target correto; validar suavização independente de FPS, teleport/respawn, limites do mapa e resolução. Não alterar a posição autoritativa.
2. **C7-B — Input sobre UI e target:** bloquear interação no mundo quando mouse está sobre UI interativa; auditar seleção próxima via posição real do player; preservar autoattack/autofollow.
3. **C7-C — Polimento da interface:** legibilidade, estados hover/desabilitado, contraste de HP/mana/XP, chat, scroll, drag, feedback consistente, Canvas e GUI em duas resoluções.
4. **C7-D — Sprites/Tiled/fishing:** verificar imports e elementos visuais existentes; registrar ausência da UI de pesca como feature, decidir implementação separada do backend que já existir.
5. **C7-E — Regressão de client:** performance/reentradas Play Mode, Editor+Windows Beta, dois clientes, sem callbacks soltos nem dupla interação.

**Regra de avanço:** nenhum workstream começa com reescrita ampla. Reproduzir primeiro; atacar bugs P1/P2, deixar polimento opcional isolado.

## 4. Matriz de QA inicial para executar no PC

| Caso | Ação | Resultado esperado |
| --- | --- | --- |
| C7-01 | Rodar 30/60/120 FPS, acompanhar player por 30+ tiles | Câmera fluida, sem salto/offset ou travamento, comparar sensação |
| C7-02 | Player morre/respawna pelo Tiled, reconecta | Câmera retoma alvo correto sem mostrar posição antiga |
| C7-03 | Andar até limites do mapa | Visual e colisão não mostram tiles fantasmas; nenhum movimento validado no cliente |
| C7-04 | Abrir HUD/chat/inventário/equip com 1280x720 e 1920x1080 | Nenhum texto cortado; botões acessíveis; mundo ainda clicável onde não há UI |
| C7-05 | Abrir banco/loja/loot sobre monstros; clicar em cada botão | Não atacar nem selecionar monstro/cadáver através da UI |
| C7-06 | Pressionar Espaço para alternar target estando longe da origem do mapa | Seleciona apenas monstros no alcance do personagem; mantém seleção anterior coerente |
| C7-07 | Alternar F follow, WASD e chat com foco | Sem movimentos/ataques involuntários; C4 continua funcional |
| C7-08 | Matar monstro, abrir corpse, coletar 8 itens | Scroll e mensagens de erro legíveis; sem item duplicado |
| C7-09 | Conferir tilesets, decorações, colisão e GIDs no Console | Sem sprite ausente ou layer invertida inesperada |
| C7-10 | Entrar/sair Play Mode três vezes e rodar Editor+build com Alfa/Beta | Sem MissingReferenceException, handler duplicado ou regressão visual |
| C7-11 | Revisar visual/ação de pesca, se houver UI | Registrar SEM UI/OK/BUG sem exigir feature nova sem escopo |
| C7-12 | Retestar arraste C6 D1–D10 após atualização do cliente | Ações distantes são bloqueadas; servidor não remove item ao recusar |

**Entrega de resultados:** C7-XX — PASSOU/FALHOU/SEM UI — Editor/build — resolução — esperado/observado — print quando visual — Console/Node. Ao confirmar um bug, abrir PR pequeno e incluir teste de contrato/reprodução.

## 5. Comandos locais — proteger alterações do Unity

Fechar o Editor antes da atualização:

    git status
    git stash push -u -m "backup Unity antes do C7"
    git fetch origin
    git switch dev
    git pull --ff-only origin dev
    git log -1 --oneline
    git status
    git stash list

Não executar git stash pop automaticamente: revisar arquivos de cena/prefabs do stash antes de aplicar. O código de C7 só será homologado após CI e QA da Unity, com C8 E2E separada.

---

## 6. C7 implementada — diagnóstico com severidade e evidências

A C6 foi homologada pelo usuário em 31/10/2026. Esta fase prioriza comportamento estável sem alterar lógica autoritativa do jogo.

| Tema | Classificação | Evidência anterior | Alteração / decisão |
|---|---|---|---|
| Câmera seguimento | **BUG REAL / P2** | Lerp com coeficiente fixo por frame, varia entre FPS | Coeficiente exponencial equivalente a 0.125 a 60 FPS, mas adaptado usando Time.deltaTime; não altera posição do player |
| Câmera zoom e mapa | **RISCO P2** | TiledMapRenderer.CenterCamera força orthographicSize = height/2 e ignora zoom | C7 cria zoom inicial 6.5 (configurável), + e -, limites conforme GameManager.MapWidth/Height; Renderer não sobrescreve zoom se houver CameraFollow |
| Câmera respawn/reconnect | **RISCO P2** | Lerp pode atravessar mapa após salto | Primeiro target e distância >= 7 tiles provocam snap, sem alterar tile ou movimento autoritativo |
| Target Espaco | **BUG REAL / P2** | OverlapCircleAll(center=transform.position de TargetSelector) | Usa PlayerController.Instance.transform.position e ordenação estável por distância e ID, sem duplicados |
| Clique através de UI | **RISCO P1/P2** | Raycast 2D do mundo mesmo com UI sobreposta | EventSystem.RaycastAll para elementos Canvas sob ponteiro antes de mirar, conversar, recolher ou abrir loot; evita target ao clicar em botão |
| Chat/inputs | **RISCO P2** | Atalhos durante entrada de texto | R da pesca, F10 da escala, +/- do zoom e Espaço do target respeitam ChatUI.IsChatActive e, quando apropriado, TMP_InputField |
| Canvas/resolução | **RISCO visual** | Cena tem CanvasScaler referência 1920×1080, MainCamera única, EventSystem único; janelas da C6 usam posições locais | F10 alterna referência de UI para 100/115/130%, sem mudar pixels do mundo. Runtime Canvas de pesca com prioridade 420, logout C6 500; conferir em build |
| Pesca sem interface | **FEATURE AUSENTE NO CLIENTE**, não bug do backend | FishingSystem já possui rod/bait/timer/skill/reward/cancelamento; comandos WS/GUI faltavam | UI compacta runtime, botão Pescar/Cancelar, R, feedback por pacote fishingStatus e progresso estimado; Node autoriza e envia resultado real |
| Água da pesca | **DÍVIDA TÉCNICA/DECISÃO DE DESIGN** | isNearWater() usa coordenada Y>=8, **não layer de água do Tiled** | Não alterar a regra silenciosamente; registrar necessidade de propriedades/tile type water autoritativos do mapa Tiled antes de liberar pesca definitiva |
| Sorting sprites/Tiled | **RISCO DE ASSET, NÃO BUG VERIFICADO** | TiledMapRenderer carrega Sprite via Resources/Tilesets, slices por GID, decorações com sortingOrder incrementais | Preservada implementação; testes Editor com mapa real, arte e import settings permanecem obrigatórios, pois CI não faz import de sprites |
| Acessibilidade | **MELHORIA REALIZADA** | Sem opção simples para escala da UI | F10: 100/115/130%, PlayerPrefs local, sem tocar stats/comandos. Contraste dark da C6 preservado, mas revisão por daltonismo, fonte e leitor de tela fica como proposta específica |
| FPS/latência | **RISCO DE UX** | UI de pesca poderia conceder recompensa ao completar barra | Barra é exclusivamente visual, conclusão e inventário vêm de packet Node; só começa após ACK e não concede loot local |

### 6.1 Câmera — regras e limites

- Script: Client/Assets/Resources/Scripts/Core/CameraFollow.cs. Usa o target serializado existente (na scenebasic.unity, CameraFollow tem target atribuído); se faltar, resolve PlayerController.Instance.
- Coeficiente alpha = 1 - (1 - smoothSpeed)^(Time.deltaTime*60). A suavização é análoga à anterior em torno de 60 FPS e quase invariável em 30/120. Sem multiplicar indevidamente smoothSpeed por deltaTime duas vezes.
- Zoom ortográfico configurável no Inspector: initialZoom 6.5, minZoom 3.5, maxZoom 12, zoomStep 0.5. '+' aproxima e '-' afasta; respeita chat digitando. Config persistida localmente sob ZagoQuest.C7.CameraZoom. ResetCamera restaura default e apaga preferência.
- Clamping visual para mapa carregado: MapWidth/MapHeight, com extents ortográficos e aspecto, sem mover player ou exigir rede. Se câmera maior que o mapa, centraliza. PixelSnap é opcional via Inspector (padrão false; PPU = 32); verificar sprites em editor para evitar shimmer.
- **Não** alterar formato/posições de mapas do Tiled, spawn ou colisão. Eventos de teleporte do Node podem provocar snap visual quando distância >= 7 tiles.

### 6.2 Pesca — contrato servidor/cliente

UI criada automaticamente pelo NetworkManager em C7FishingUI, sem adicionar manualmente GameObject à Hierarchy. Durante Play Mode aparecem C7FishingUI no NetworkManager e C7FishingCanvas runtime, com "PESCA", status, barra e botões Pescar/Cancelar. **R** inicia pesca quando conectado e fora de inputs. Clique Cancelar envia comando. A interface oculta-se ao desconectar.

Protocolo estrito:
- Cliente -> Node: startFishing sem campos e cancelFishing sem campos; validação discriminatedUnion/Zod rejeita client-supplied playerId, itemId, tempo, posição ou recompensa.
- Node -> cliente: fishingStatus {state: started|completed|cancelled|rejected, message, durationMs}. O durationMs só desenha uma estimativa de progresso, o item/skill continuam no Node.
- startFishing usa FishingSystem.startFishing(player,world,hooks), preserva seleção de vara/isca, timeout, recompensa e skill originais; depois do ACK inicial atualiza Inventory (isca opcional). No término envia inventário real e stats; cancelamento por movimento, botão, morte ou disconnect chama FishingSystem.cancelFishing e cancela o timer.
- O callback temporário de cada pescaria reside em WeakMap por jogador, eliminado em complete/cancel; onComplete só envia pela socket ainda OPEN. Impede entrega de loot após cancelamento e vazamento de outro personagem.
- **LIMITE IMPORTANTE:** startFishing ainda considera "perto da água" por regra provisória Y>=8 e não checa tile de água do Tiled; UI não representa escolha visual do tile. Isso deve ser um workstream futuro de gameplay/servidor, não um bug criado ou resolvido pela UI C7. Assets adicionais (vara animada, bobber, partículas) ainda não implementados.

### 6.3 Layout, Canvas e controle de foco

- C7UiAccessibility instalado no mesmo GameObject do NetworkManager. F10 aplica UI scale 100,115,130 com player prefs; CanvasScaler no modo ScaleWithScreenSize herda escala. Aplica também em Canvas runtime de pesca e logout da C6. Não altera sprites do mapa.
- C7FishingCanvas usa ScreenSpaceOverlay sort=420, menor que LogoutOverlay sort=500. Verificar interação dos componentes visuais no Unity Editor e em resoluções 1280x720/1920x1080; janelas C6 continuam arrastáveis e salvam posição local.
- TargetSelector antes de interagir com o mundo chama EventSystem.RaycastAll e recusa cliques em Canvas, evitando selecionar monstros "atrás" do inventário/loja/loot. Os elementos UI intencionais têm Raycast Target; labels decorativos não bloqueiam.
- Sprite sorting: Ground/Decoration continuam sob TiledMapRenderer; não mudar sorting layers por inferência, pois GIDs e camadas dependem da versão do mapa real. Testar quadro a quadro e logs de GIDs sem sprites.
- Acessibilidade pendente: teste de contraste mínimo de texto, ajustes específicos para daltonismo, fonte dinâmica além de escala global, teclado sem mouse e legendas de eventos de áudio (áudio de pesca ainda inexistente). Não considerar esses itens implementados.

## 7. QA adicional — C7-13 até C7-31 (Editor, Build Windows, duas sessões)

| Caso | Ação | Aceite |
|---|---|---|
| C7-13 | Caminhar 30+ tiles em 30/60/120 FPS | Seguimento semelhante, sem oscilações/teleporte indevido |
| C7-14 | Reconectar, morrer/respawn e usar spawn Tiled | Câmera reposiciona no novo target com snap distante |
| C7-15 | Passear pelos quatro cantos do mapa carregado | Sem área fora do mapa exposta, salvo quando mapa menor que viewport |
| C7-16 | Apertar +/- até limites e reiniciar Play | Zoom clamped 3.5–12, configuração salva |
| C7-17 | Apertar Espaço a vários tiles da origem | Só seleciona monstros no range do PLAYER, alterna estavelmente por distância |
| C7-18 | Abrir Merchant/Bank/Inventário acima de monstro e clicar no UI | Nenhum StartAutoAttack, ClickInteract, Pickup ou Loot inadvertido |
| C7-19 | Abrir chat e digitar "r + - f10" | Nenhum comando de pesca, zoom ou escala durante digitação |
| C7-20 | Com conta logada, R perto da água e com vara | FishingUI estado started, barra com durationMs do Node; inventário reflete isca |
| C7-21 | Tentar R sem vara / longe do ponto provisório Y>=8 | fishingStatus rejected, não altera inventory/skill |
| C7-22 | Iniciar e clicar Cancelar | Cancelled, barra reinicia, sem loot após timeout |
| C7-23 | Pescar e mover o jogador durante | Cancelled por servidor, mesmo com botão não pressionado |
| C7-24 | Pescar até concluir | Completed somente após WS; inventário real e skill coerentes |
| C7-25 | Desconectar durante pesca e relogar | Nenhuma recompensa atrasada, HUD oculto na desconexão |
| C7-26 | Pressionar F10 três vezes | 100->115->130->100, legibilidade e posições de janelas preservadas |
| C7-27 | F10 + mudar resolução 1280/720 e 1920/1080 | Layout acessível sem botões cortados; C6 drag/loot permanecem interativos |
| C7-28 | Verificar import Sprite Multiple e logs Tiled/GIDs | Nenhuma camada quebrada; se GIDs ausentes, corrigir assets separadamente |
| C7-29 | Abrir/fechar Editor Play Mode três vezes | Sem handlers duplicados, eventos de pesca após destroy ou vazamento de callbacks |
| C7-30 | Rodar Windows Build com 2 contas, NPC, loot, banco e pesca | Mesmas regras de Input/foco, ambas contas isoladas |
| C7-31 | Revisar Scene Hierarchy sem mexer em YAML | Só novos objetos runtime C7, nenhum prefab/asset de cena regravado |

**Resultado preenchível:** ID | Editor/Windows | resolução | PASS/FAIL | observado | console Node/Unity | screenshot. Testes Node verificam contratos e handler real com FakeTimers, mas **não substituem compilação C# pelo Editor, execução de cena nem validação da arte**.

## 8. Recomendações futuras priorizadas (fora da C7 necessária)

1. **P1 design / pesca no Tiled:** marcar tile "water" com propriedade no Tiled JSON, carregar/validar no Node e enviar estados de pesca por tile. Decidir se apontar tile por clique; proteção contra spoofing/alcance e nova economia de isca.
2. **P2 UI**: âncoras/snap de janelas, minimização, redimensionamento acessível, tooltips, estado de foco visual e indicadores de conexão/latência.
3. **P2 visual**: ícones de itens e sprites reais, bobber/linha animada durante pesca, efeitos leves de água e áudio opcional; só depois de escolher assets e validar import.
4. **P2 acessibilidade**: teste manual de contraste e daltonismo, size mínimo de fontes em 1280x720, navegação por teclado, mensagens visuais para áudio.
5. **P3 profiling**: rastrear alloc/GC de OverlapCircleAll e criação dinâmica de UI sob sessões de 60+ min, medir FPS em Windows low-end, organizar addressables se necessário.

## 9. Integração técnica

Branch feat/client-c7-camera-input-fishing-ux, base dev C6 commit 293c6ff; GitHub Actions Node Linux/Windows e PostgreSQL, tests/clientC7Fishing.test.ts e tests/clientC7UxContracts.test.ts; os testes de contrato da fase 7 NÃO abrem Unity. Merge apenas na dev depois que CI aprovar; main intocada. Conferir C7-13–C7-31 no PC antes de marcar homologação visual.
