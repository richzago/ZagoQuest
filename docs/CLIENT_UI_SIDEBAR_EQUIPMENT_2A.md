# ZagoQuest — UI 2A · Equipamentos encaixados na sidebar (PR empilhado)

## Revisão visual solicitada após teste Unity — 31/10/2026

O usuário testou a primeira versão do PR #116 e pediu oito refinamentos. Esta revisão permanece **na mesma branch e PR #116**, sem merge.

### Origem confirmada do título duplicado

A leitura da cena `Client/Assets/scenebasic.unity` comprovou que `EquipmentPanel` possui filho direto chamado **`Equipaments`**, com `TextMeshProUGUI` e texto de título. O cabeçalho C6 e o título da nova sidebar são construídos em runtime. A revisão agora desativa `EquipmentPanel/Equipaments`, `C6Title`, `C6DragHeader` e `C6Help` **somente enquanto o painel original está encaixado**; o título `EQUIPAMENTOS` da sidebar é o único visível. Estados anteriores de `Equipaments`, `C6Help`, arraste/X são guardados e restaurados no teardown.

### Alterações realizadas

1. **Equipamentos menores e menos poluídos:** card de 369 para ~290 (285 na disposição compacta); slots existentes de 56 para **52 unidades**, passo horizontal 65, vertical 58; auto sizing de nome de itens entre 7.5 e 11, com quebra de linha, sem alterar itemId/dados ou callbacks. Ainda cabe o BOOTS na quarta linha, inclusive na versão compacta. Sem texto "Arraste os itens para equipar/retirar".
2. **Minimapa realmente circular:** placeholder `MiniMapCircularPreview` com sprite circular de 128×128 gerado localmente por `CreateCircularMiniMapTexture`; pixels fora do círculo transparentes, contorno dourado discreto, texto "EM BREVE". **Não implementa mapa Tiled nem tracking ainda.** Sprite/Texture destruídos no ciclo de vida.
3. **Sidebar presa às três bordas:** `SidebarSurface` tem `anchoredPosition=Vector2.zero`, `sizeDelta=(SidebarWidth,0)`, ancorada do topo ao fundo e flush à direita. Elimina as margens superior, inferior e direita.
4. **Seis pictogramas geométricos:** engrenagem, áudio, chat, mochila, bússola e ajuda, criados de `Image` e texto `?`, sem siglas `CFG`, `SOM`, `AJUDA`; nenhum possui clique ou comportamento inventado. `raycastTarget=false` em TODOS os elementos decorativos.
5. **Responsividade:** `RefreshResponsiveLayout` realinha Cards e círculo conforme altura efetiva do Canvas, incluindo F10; `SidebarDynamicHost` continua reservado, sem reparent de Loot/Backpack. **Redimensionamento manual fica para a etapa 3**.
6. **Painel de pesca oculto por padrão:** `C7FishingUI` preserva sua tela apenas como objeto desativado, mantém tecla **R**, timer recebido do Node, mensagens do chat e cancelamento via handlers; `ShowFishingPanel=false` impede sobreposição e raycast da janela. **Nenhuma alteração na chance, tempo, água, vara, isca ou lógica do Node**.
7. **Fishing no Status:** server `playerStats` recebe campo `fishingLevel: player.getSkillLevel(SkillType.FISHING)`; o contrato TS e `PlayerStatsData.cs` adicionam o campo e `StatusManager` desenha `Pesca   Nível X` (ou traço antes de snapshot). O servidor já atualiza `playerStats` após conclusão da pesca; **não há progresso calculado no Unity**.
8. **Proteção permanente de input:** `TargetSelector.cs` e `IsPointerOverUi` não foram editados; Canvas raiz fullscreen continua sem Graphic, fundo da barra visível é a única cobertura, slots reais continuam com raycast, imagens decorativas não. Clique1 START, clique2 STOP e corpse loot são testes obrigatórios.

### Testes da revisão

- `server/tests/clientC8SidebarContracts.test.ts`: inclui asserts contra o YAML da cena que prova o objeto `Equipaments`, posição flush, UI redonda, pictogramas, nova geometria e regressões dos cliques.
- `server/tests/clientC8SidebarPolish.test.ts`: exercita `PlayerStatsSender.toPayload` com Fishing 42, verifica a chegada ao Status e o HUD de pesca oculto sem desabilitar a tecla R.
- A CI Node/Windows/Linux/PostgreSQL **não compila C# nem executa a cena**. Requer Play Mode e inspeção visual do usuário.

### Checklist de QA adicional (não substitui a checklist anterior)

- [ ] Somente um título de EQUIPAMENTOS; `Equipaments` antigo oculto.
- [ ] 10 slots legíveis; um item com nome comprido permanece dentro dos limites; drag/drop e USEFUL/BOOTS ok.
- [ ] Card mais baixo e resto da barra não sobrepõe; layout 1920×1080 e 1280×720 com F10 100/115/130%.
- [ ] Minimapa aparece **redondo** e continua estático (placeholder).
- [ ] Sidebar sem espaços no topo, base e direita, sem expandir raycast além da própria barra.
- [ ] 6 ícones gráficos ao invés das siglas; não agem como botões falsos.
- [ ] Painel de pesca NÃO aparece; R continua enviando início de pesca e respostas ainda aparecem no chat.
- [ ] Abrir Status (P) mostra `Pesca Nível X` retornado pelo Node (testar após pesca que aumente skill).
- [ ] Primeiro clique ataca; segundo clique no mesmo monstro interrompe; corpse abre loot; UI real impede clique somente sobre sua superfície.
- [ ] Pesca/gameplay/câmera/loot/backpack em si continuam sem alterações. **PR Draft, sem merge até autorização explícita.**

---


**Objetivo visual:** obter uma interface de MMORPG 2D inspirada em Tibia, mas limpa e moderna, com sidebar sempre disponível e equipamento **funcional dentro da coluna**, sem sobrepor a nova barra.

**Base e dependências:** branch `feature/client-ui-sidebar-equipment-2a` criada a partir de `feature/client-ui-sidebar-step1` / [PR #115](https://github.com/richzago/ZagoQuest/pull/115), que ainda NÃO foi integrado à `dev`. O hotfix de combate/loot aprovado no Unity está na `dev` desde [PR #114](https://github.com/richzago/ZagoQuest/pull/114), merge `911cc8e`. **Nenhum PR de UI pode ser integrado antes do teste visual e sinal verde explícito do usuário.**

## Layout entregue, quatro zonas em ordem

1. **Minimapa futuro:** quadro `MiniMapSection`, título, subtexto e indicação `MAPA EM DESENVOLVIMENTO`. **Não há renderização de mapa nem funcionalidades de minimapa** nesta etapa.
2. **Equipamentos funcionais:** quadro `EquipmentSection`; o `EquipmentPanel` ORIGINAL de `HUD/TopRight` passa a ser filho de `EquipmentHost` durante Play Mode. Não há prefab ou `EquipmentUI` duplicados. **Dez slots existentes** (amulet, helmet, backpack, weapon, armor, shield, ring, legs, useful, boots) são centralizados em grade 3+3+3+1; cada `EquipmentSlotUI` continua com IDs, drag/drop, snapshot e referencia ao Node intactos. A alça C6 de arrastar, o título extra e o botão X do painel são ocultados. O toggle legado não fecha o painel enquanto estiver encaixado.
3. **Acesso rápido futuro:** `SettingsIconsSection` exibe quatro rótulos discretos `CFG`, `SOM`, `AJUDA`, `···`, SEM clique nem falsas funções.
4. **Conteúdo dinâmico:** quadro `DynamicContentSection`, com `SidebarDynamicHost` real e vazio. **Esta PR não redireciona loot nem backpack ainda**: o host foi preparado para a microetapa seguinte, quando redirecionamento, largura de linhas, scroll e interações serão inspecionados e testados isoladamente. As janelas atuais de loot/inventário permanecem no seu lugar nesta etapa; não afirmamos que já abrem dentro da barra.

## Estética

- Fundo profundo `#121B27`; painel interno `#1D2938`; interior `#172230`.
- Contorno dourado discreto `#AF8B50`; textos quentes `#EBE9E2`; secundários `#AABCCA`.
- Coluna direita de largura estável **304 unidades de UI**, marginada 12px; minimapa 141, equipamentos 369, ícones 68; área dinâmica ocupa restante da altura (com ajuste de overflow para F10).
- Nenhum sprite/font importado, novo pacote ou dependência de recursos externos. Placeholder com componentes Canvas/TextMeshPro padrão.

## Diagnóstico real no código / solução de menor risco

- **Regressão visual:** `C6InventoryEquipmentLayout.Equipment()` reposiciona a `EquipmentPanel` no Canvas HUD, com largura 276 e altura 500, no centro-direita. A sidebar criada em #115 é um Canvas separado. Por isso, o equipamento antigo cobre o novo layout.
- **Ordem de inicialização:** `EquipmentUI.Start()` ainda prepara os slots via C6 e pode reposicionar o painel; `C8SidebarShell.LateUpdate()` aguarda existir o `C6DragHeader`, confirmando que o layout C6 foi criado, e só então encaixa o mesmo painel no `EquipmentHost`. Sem reexecutar C6 nem mover o painel em todo frame.
- **Input/raycast:** `TargetSelector.cs` e `IsPointerOverUi` **inalterados**. O `C8SidebarCanvas` fullscreen NÃO possui `Image`; somente `SidebarSurface` visível tem `raycastTarget=true`. Textos e cards usam `raycastTarget=false`. O `EquipmentPanel` real e os `EquipmentSlotUI` mantêm raycasts legítimos para drag/drop dentro da coluna.
- **Sorting:** sidebar em `sortingOrder=110` (HUD antiga 0; pesca 420; login 500). Necessário para o EventSystem não entregar o drag/drop do equipamento para uma `Image` transparente da HUD antiga que ainda possa estar sobre a região. Fora da coluna não há `Graphic`, portanto não deveria afetar combate/loot.
- **Resolução e acessibilidade:** permanece `CanvasScaler` C7 com F10 (100/115/130%). O espaço dinâmico esconde o aviso e reduz seu host em escalas altas para evitar retângulo invertido. Nenhum `Camera.rect`, zoom ou viewports alterados.
- **Lifecycle:** sidebar some quando desconectada; uma conexão subsequente reutiliza o mesmo Canvas. `OnDestroy` devolve o painel original ao parent anterior **restaurando âncoras, offsets, pivot, escala, alça e X pré-existentes**, antes de destruir a sidebar, evitando tanto destruir os slots quanto criar um overlay de raycast em tela inteira.

## Alterações estritamente dentro da UI

- `Client/Assets/Resources/Scripts/UI/C8SidebarShell.cs`: construção, quatro seções, encaixe do objeto EquipmentPanel original, grade, guarda de raycast, zona dinâmica reservada.
- `Client/Assets/Resources/Scripts/UI/EquipmentUI.cs`: flag puramente visual `IsDockedInSidebar` para impedir botão toggle legado de ocultar o painel fixo; protocolo e update dos itens não mudam.
- `server/tests/clientC8SidebarContracts.test.ts`: testes **estáticos** de zonas, preservação da instância, slots, cálculo de encaixe, input e ausência de gameplay/câmera.
- Documentação: este arquivo e `docs/CLIENT_AUDIT_ROADMAP.md`. **Nenhuma alteração em `scenebasic.unity` é necessária**: referências serializadas permanecem como estão.

## Homologação visual no Unity, obrigatória ANTES do merge

- [ ] 01. Abrir `Client/Assets/scenebasic.unity` e iniciar Play Mode sem erros de compilação C#.
- [ ] 02. Login: sidebar aparece, equipamento NÃO fica sobreposto ao lado de fora; nenhum `EquipmentPanel` duplicado na Hierarchy.
- [ ] 03. Confirmar **dez slots**, incluindo Boots e Useful, sem clipping nem textos sobrepostos.
- [ ] 04. Equipar e desequipar por drag/drop, verificar que a barra renderiza o item correto após snapshot do Node.
- [ ] 05. Abrir inventário por I; arrastar item ao slot do equipamento; fazer arraste reverso ao inventário; o servidor decide os resultados.
- [ ] 06. Checar resolução 1920×1080 e 1280×720, com F10 em 100/115/130%; colunas e títulos legíveis.
- [ ] 07. Minimap e ícones são placeholders não interativos; área dinâmica continua vazia, sem reparent prematuro de loot/backpack.
- [ ] 08. Teste de regressão **CRÍTICO**: 1 clique em monstro fora da sidebar INICIA; 2º no mesmo monstro PARA; Espaço seleciona; corpse fora da barra abre loot.
- [ ] 09. Dentro da sidebar, clique no fundo não deve atacar monstro por trás; fora da sidebar nenhum Canvas transparente bloqueia mouse.
- [ ] 10. Inventário, merchant, banker, status, chat, loot, coleta e pesca continuam inalterados; nenhuma mudança em câmera/viewport/zoom.
- [ ] 11. Logout, login e reconexão: barra não duplica, equipamento permanece referenciado.
- [ ] 12. Console sem exceções e, idealmente, build Windows; registrar screenshot da Game View 1280×720 e 1920×1080.
- [ ] 13. **Aceite explícito do usuário antes de qualquer merge**.

## Próximas microetapas — não implementadas aqui

- **UI 2B:** loot/backpack funcional dentro de `SidebarDynamicHost` com seus controles reais e scroll, sem alterar payloads do servidor. Somente após aceite da UI 2A.
- **UI 3:** redimensionamento exclusivamente vertical, coordenação entre painéis, sem alterar largura.
- **UI 4:** adaptação de câmera/área jogável, após os testes anteriores. Não reutilizar `Camera.rect` de #111 sem homologação visual isolada.

**Fluxo Git:** confirmar PR #115 e esta etapa no Unity; somente mediante autorização integrar #115 à `dev`; então retargetar PR 2A para `dev` e integrar **apenas com autorização própria**. Nada tocar na `main`.
