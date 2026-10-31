# ZagoQuest — C7: Auditoria de UX e funcionalidades visuais do cliente Unity

**Abertura técnica:** 31/10/2026  
**Base:** dev após [C6 PR #104](https://github.com/richzago/ZagoQuest/pull/104), commit 2626464c2a68dc6af6ce1d1b39429ab20867d1d3.  
**Estado:** C7 INICIADA PARA AUDITORIA, sem correção de gameplay nem homologação Unity. C6 possui 10 cenários D1–D10 de reteste após P1 de drop distante.  
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
