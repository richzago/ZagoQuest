# C1 — Auditoria de Tiled, sprites, layers e colisão (31/10/2026)

**Fonte:** `assets/maps/test-map.json` (Node) e `Client/Assets/Resources/Maps/test-map.json` (Unity).
**Status atualizado (31/10/2026):** alinhamento Grid/água/colisão VALIDADO LOCALMENTE pelo desenvolvedor; conversão Y das object layers (spawns) em andamento e requer QA antes de encerrar C1. As seções antigas abaixo registram o histórico de problemas já corrigidos.

## Verificações feitas no repositório

- Mapa **30×20**; JSON fonte e cópia Unity são iguais no SHA de entrada da Fase C1.
- Layers: `Ground`, `Decoration`, `Collision` (tile layers) e `PlayerSpawn`, `MonsterSpawn`, `NPCSpawn` (objetos Tiled).
- `Ground`: 600 células preenchidas; tilesets `Grass1-Dirt1` (GIDs 6–10) e `Water2` (GIDs 68–75) efetivamente utilizados nesta versão.
- `Decoration`: 600 células vazias.
- `Collision`: **600 células vazias**. Isso significa que a matriz local de colisão recebe `false` em todas as posições. **Não presumir que água/paredes estão bloqueadas**. Se devem bloquear movimento, definir tiles na camada `Collision` do Tiled e sincronizar o JSON no Node e Unity, testando depois. A presença de sprites de água não torna automaticamente o tile impassável.
- `PlayerSpawn`, `MonsterSpawn`, `NPCSpawn` existem. Pelo log, o **Node** carrega NPC Banker, Merchant e Goblin; evitar spawn local extra no Unity para não duplicar entidades.
- `[A]Wall-Up1_pipo.png` está em Resources desde PR #80 com 5 sprites; metadados de `[A]Grass1-Dirt1_pipo.png` (5 sprites) e `[A]Water2_pipo.png` (40 sprites) também cobrem GIDs usados.
- **Comportamento de desenho corrigido nesta PR:** `RenderGround()` passa a selecionar pelo nome `Ground`, e `RenderAllTileLayers()` **não renderiza Collision**; isso evita que, ao pintar colisões no Tiled futuramente, a camada lógica apareça como decoração visual. GIDs ausentes geram **um resumo por layer**, sem milhares de logs repetidos.

## Critérios de C1 / próximos testes no Editor

1. Abrir `Assets/scenebasic.unity` com Node ligado. Comparar posições (PlayerSpawn, banker, merchant, goblin) com o JSON e a renderização no Game View.
2. Mover por chão e água; **registrar** se é desejado que água bloqueie movimento. Não confundir movimento aceito pelo Node com predição visual Unity.
3. Abrir Tiled e conferir se a camada `Collision` é intencionalmente vazia; se não for, pintar obstáculos **no Tiled**, salvar o arquivo canônico e atualizar a cópia em Resources antes de testar.
4. Após adicionar colisões, confirmar que as regiões ficam bloqueadas no servidor e na matriz local, sem tiles de colisão desenhados por cima da arte.
5. Confirmar que reabrir cena/Play não duplica Grid/Tilemap gerados.
6. Testar mapa com GID ausente em cópia descartável e observar um aviso resumido no Console; **não alterar o mapa principal só para simular erro**.

## Fronteira arquitetural

- Tiled fornece dados de mapa/spawn.
- Node mantém autoridade sobre deslocamento, combate e spawns. Unity renderiza e pede movimento.
- Unity usa `Collision` para UI/pathfinding e não decide movimento definitivo. O Node deve validar usando a **mesma versão de mapa**.
- QA em `server/tests/clientC1TiledContracts.test.ts` valida estrutura estática; não substitui Play Mode, editor de Tiled ou testes com água/paredes.

### Acompanhar no Notion

[Auditoria viva do cliente Unity — C0–C8](https://app.notion.com/p/40aec07d7c4f818eac62d7d6a2b2d933)

**Próxima ação:** testar bloqueio de água/paredes e confirmar se a Collision vazia é intencional; não criar colisão artificial no servidor nem alterar dados Tiled sem esse critério de gameplay.

## C1 — Entrada após homologação C0, inspeção e PR de alinhamento

**Marco:** C0 encerrada em 31/10/2026, por confirmação de funcionamento local do Unity Editor e executável Windows com Teste Alfa/Beta. C1 prossegue separadamente, sem alterar o `main`.

### Achados classificados

**BUG COMPROVADO — P1 latente, decoração deslocada:** `Client/Assets/scenebasic.unity` mantém o `MapManager` como GameObject root em (-3.29089, 0.13581), enquanto o `groundTilemap` está em um objeto `Tilemap` filho de `Grid` na origem (0,0). Antes, `RenderAllTileLayers()` criava `Tilemap_Decoration` sob o `MapManager`. Assim, uma camada decorativa não vazia ficaria deslocada em relação ao Ground. O problema não era visível no mapa atual, pois `Decoration` tem 600 células vazias.

**CORREÇÃO C1 nesta PR:** as novas Tilemaps visuais ficam sob o mesmo `Grid` do Ground, com transform local igual e sorting layer compatível. A implementação também evita criar camadas vazias.

**RISCO A VERIFICAR — P1 futuro, convenção Y:** `DrawLayer` representa linha Tiled `y` no Unity como `height - 1 - y`, enquanto o `MapLoader` do servidor e `ApplyCollision` do cliente usam `y` diretamente como coordenada lógica. É uma divergência de mapeamento visual/lógico que se tornará relevante ao pintar `Collision` ou usar um layout assimétrico. Não inverter o mapa ou a posição persistida automaticamente: primeiro comparar posições e decidir o espaço de coordenadas adotado para todo o jogo.

**DECISÃO DE DESIGN:** a `Collision` real está vazia. Definir explicitamente no Tiled se água, paredes e objetos sólidos devem bloquear movimento. Não aplicar bloqueios diretamente no Unity; Node continua autoritativo.

**MELHORIA DE ESTABILIDADE:** validar `data.Length == width * height` para Ground, Decoration e Collision antes de iterar. Impede que exportação incompleta provoque `IndexOutOfRangeException` no Play Mode.

**DÍVIDA TÉCNICA:** mapa no `assets/maps/test-map.json` e cópia no `Client/Assets/Resources/Maps/test-map.json`. Teste já compara as duas versões, e agora os testes C0/C1 foram adicionados explicitamente ao `npm test`, executado na CI.

### Checklist prático para o próximo teste local da C1

1. Abrir `Assets/scenebasic.unity`; Play Mode, conferir o cenário 30×20 sem novos erros e sem `Tilemap_Decoration` vazia.
2. No Hierarchy, localizar `Grid/Tilemap` (Ground). Uma `Decoration` não vazia deve ser filha **do mesmo Grid**, e não de `MapManager`. Validar com **cópia de teste** do JSON, sem alterar o mapa canônico só para simular.
3. Comparar onde aparecem os NPCs e o Goblin com os objetos `PlayerSpawn / MonsterSpawn / NPCSpawn` do Tiled.
4. Confirmar visualmente a orientação do mapa, principalmente a posição das faixas de água; verificar se as coordenadas visualizadas combinam com as coordenadas autoritativas enviadas pelo Node.
5. Para testar colisões, usar cópia separada do mapa/Tiled e marcar um tile de teste na camada `Collision`, depois confirmar que não é desenhado como sprite de cenário nem permite atravessar o bloqueio no servidor.
6. Ao consolidar o Tiled, manter JSON do Node e cópia Unity sincronizados. Evitar edição manual de posições no cliente.

**Não concluída:** C1 só poderá ser homologada após Play Mode do usuário, conferência de coordenadas, teste de colisões e decisão de uso da camada Collision.

## C1 — Decisão aprovada: água e paredes bloqueiam movimento (31/10/2026)

**Nova decisão do desenvolvedor:** testes locais do alinhamento/visuais C1 foram aprovados. **Água e paredes são impassáveis**, usando o Tiled como origem da matriz de colisão e o Node como autoridade. O Unity não implementa uma segunda regra de jogabilidade.

### Implementação desta entrega

1. `assets/maps/test-map.json` e `Client/Assets/Resources/Maps/test-map.json` receberam a mesma camada `Collision`: **264 tiles de água bloqueados**, preservando **336 tiles de chão** (30×20). A camada original estava 100% vazia. O mapa **não contém paredes desenhadas atualmente**; não foram inventadas paredes.
2. Os tiles de água no `Ground` têm GIDs **68–75** (tileset `Water1`, faixa 36–75). O tileset `Wall1` está na faixa **31–35**, mas sem células utilizadas neste mapa.
3. A camada `Collision` contém os próprios GIDs dos tiles de água nas mesmas posições de edição no Tiled. **Quando adicionares paredes** ao `Ground` ou `Decoration`, pinta as respectivas células também em `Collision`; o teste automatizado avisa se uma parede ou água visível ficou sem bloqueio. É a `Collision` (e não o ID do sprite no cliente) que define a regra.
4. Correção de orientação: Tiled utiliza `row=0` no topo, enquanto o `DrawLayer` do Unity usa `worldY = height - 1 - row`. `MapLoader` (Node) e `ApplyCollision` (Unity) passaram a inverter o Y na **leitura da Collision**. Isso evita que uma parede assimétrica bloqueie o lado oposto do mapa.
5. `MovementSystem` mantém autoridade, limite de passo, cooldown e proteção contra atravessar cantos na diagonal; a correção não muda essas regras.
6. Novo teste `server/tests/tiledCollision.test.ts`, incluído em `npm test`: confere os dois JSONs, a cobertura de água/parede em Collision, o total **264/336**, movimentos recusados e exemplo assimétrico de parede/água. Ajustado `tiledRespawn.test.ts` para a coordenada Y convertida.

### Compatibilidade / limites

- **Não alterar as posições salvas de personagens.** A transformação foi aplicada somente à camada `Collision`. O mapa atual é simétrico nas bordas de água, então as posições persistidas e os objetos já existentes permanecem nas faixas de chão.
- **Risco C1 ainda aberto — object layers:** `MapLoader` lê `PlayerSpawn`, `MonsterSpawn` e `NPCSpawn` com `Math.floor(obj.y / tileheight)`, enquanto Ground/Collision invertem Y. Isso significa que a localização de objetos no editor Tiled pode não corresponder à linha visual na Game View em um mapa assimétrico. **Não migrar Y dos personagens, NPCs ou monstros sem um teste dedicado e estratégia para posições persistidas**. A decisão desta entrega é corrigir água/parede mantendo gameplay existente.
- Os testes automatizados C# continuam **estáticos**: a CI Node valida o contrato, mas não compila Unity. O desenvolvedor precisa fazer Play Mode e build ao testar colisões.
- O JSON é a única fonte do mapa versionado neste repositório. Se o Tiled tiver um arquivo local .tmx não versionado, **atualize-o antes de exportar** para não sobrescrever a camada Collision com uma versão antiga. Preferencialmente edite o JSON canônico diretamente no Tiled e copie o export para Resources.
- A camada `Collision` é **lógica**. No Unity ela não é desenhada sobre Ground ou Decoration.

### Testes locais de aceite após esta PR

- [ ] No Unity com servidor atualizado, caminhar de `(3,3)` até a água à esquerda `(2,3)`: personagem não atravessa. O servidor deve responder com posição real.
- [ ] Caminhar na direção de água em outras bordas (norte, sul, leste); movimento recusado e sem deslocamento indevido.
- [ ] Testar diagonais perto do limite da água, sem atravessar cantos.
- [ ] Editar **uma cópia de teste** do Tiled com parede assimétrica, pintar `Collision` na mesma célula, sincronizar o JSON temporário com Node/Unity e confirmar bloqueio visualmente no mesmo local.
- [ ] No pgAdmin, comparar `posX/posY` de Alfa/Beta antes/depois de testar; valores só mudam quando um movimento é aceito, e reiniciar servidor preserva última posição válida.
- [ ] Confirmar que Banker, Merchant e Goblin continuam carregando, NPCs interagem e duas contas continuam independentes.
- [ ] Após testes, registrar resultados e fechar a C1 somente se todas as convenções e bloqueios se mostrarem consistentes.

**Status:** C0 concluída após aceite do desenvolvedor; C1 com decisão de gameplay implementada e QA de água/parede pendente.

## C1 — Bug de meia célula, deslocamento assimétrico nas bordas (31/10/2026)

### Relato reproduzido analiticamente a partir da cena

Após PR #86 (água/parede na Collision), desenvolvedor relatou: **esquerda/baixo o boneco entra cerca de 1 sqm na água; direita/cima para cerca de 1 sqm antes do limite do chão**. Reportou hipótese de recorte dos pixels do tileset.

**BUG COMPROVADO na configuração versionada do Unity:**
- `Grid` estava em `(0,0)`, `Tilemap` filho em `(0,0)`; Grid.cellSize=`(1,1)` e Ground.tileAnchor=`(0.5,0.5)`.
- Os tiles renderizados por `TiledMapRenderer.DrawLayer` com célula inteira `(x,y)` têm **centro visual `(x+0.5,y+0.5)`**.
- `PlayerController.OnServerInit` e `OnPositionReceived` usam `transform.position=(x,y,0)`, sem o `+0.5`. O mesmo vale para os avatares remotos e demais entidades desenhadas via posições inteiras do Node.
- Assim o personagem é desenhado **meio tile à esquerda e embaixo do centro do tile autorizado pelo servidor**, gerando exatamente o padrão de assimetria relatado. O tamanho do jogador é 0.8 e pode dar a impressão visual de um sqm inteiro.
- As sprites consultadas usam slices 32×32, Pixels Per Unit 32 e pivot central (0.5,0.5). **Não há evidência de recorte incorreto dos PNGs como causa principal.**

**A matriz está correta:** o JSON 30×20 tem água em `x=0..2,27..29` e `row=0..2,17..19`. Após inversão Y, células logicamente caminháveis são `x=3..26,y=3..16`; a água bloqueia corretamente `x=2,27,y=2,17` nas bordas. Não corrigir movendo a Collision: isso geraria inconsistência entre terreno/servidor/UI.

### Correção mínima nesta PR

- `Client/Assets/scenebasic.unity`: alterar **apenas o Transform de `Grid` de `(0,0,0)` para `(-0.5,-0.5,0)`**. Como o Tilemap usa anchor central, centro visual agora fica em `(-0.5 + x + 0.5, -0.5 + y + 0.5) = (x,y)`.
- Todas as camadas visuais adicionais da C1 já são filhas do mesmo Grid (PR #85), e portanto acompanham o deslocamento.
- **Não** alterar `PlayerController`, `EntityManager`, os dados Tiled, `Collision`, spawns, WebSocket, SQL, posição de personagem ou cálculos de combate/pathfinding.
- Teste de contrato `clientC1TiledContracts.test.ts` verifica a configuração da cena, a matemática de alinhamento para os quatro cantos do terreno e o centro do mapa, as bordas de água, a posição inteira do PlayerController e metadados de sprites. **O teste é estático e não substitui Play Mode em Unity.**

### Checklist de aceitação local desta mudança

1. Com a nova `dev`, abrir `scenebasic.unity` no Unity, confirmar **Grid Position X=-0.5, Y=-0.5**; `Grid/Tilemap` permanece Position (0,0).
2. Teste Alfa ou Beta em `(3,3)`: deverá ficar **centralizado** no último tile de chão, sem parecer entrar na água à esquerda/embaixo.
3. Aproximar da água nas quatro direções. O último tile caminhável é `x=3` (esquerda), `x=26` (direita), `y=3` (baixo) e `y=16` (cima), excluídas as posições ocupadas por NPCs, monstros ou outros jogadores.
4. Testar movimentação diagonal nos quatro cantos, cancelamento de movimento bloqueado, e sincronização Alfa/Beta.
5. No Console do servidor, confirmar que o movimento bloqueado não altera a posição autoritativa; desligar e religar para validar persistência normal.
6. Se ainda houver divergência, conferir no Unity durante Play Mode `Tilemap.GetCellCenterWorld(new Vector3Int(x,y,0))` comparado com `PlayerController.transform.position`, sem alterar a Collision para compensar problemas visuais.
7. **C1 só se encerra após novo aceite local.** Auditoria futura de object layers (spawn Y top-down) continua separada: o ajuste do Grid não converte posições de NPCs nem migra personagem persistido.

**Referência Unity:** `Tilemap.GetCellCenterWorld` e `Tilemap.tileAnchor` calculam o centro conforme o anchor. `Grid.CellToWorld` retorna canto inferior esquerdo, não centro visual; o default do Tilemap é (0.5,0.5).

## C1 — Regressão visual após PR #87: diagnóstico instrumental (31/10/2026)

**Novo relato local:** esquerda corrigida; **direita e cima** ainda impedem movimento aparentemente 1 sqm antes de água; **embaixo** jogador ainda aparenta entrar 1 sqm na água. Esse resultado **reprova o aceite visual** da PR #87 para os 4 lados. **C1 continua ABERTA.**

### Investigação minuciosa dos dados versionados

- Matriz `Ground`: 30×20, interior de terra `x=3..26` e `y=3..16` no mundo Unity/Node. Água ocupa `x=0..2`, `x=27..29`, `y=0..2`, `y=17..19` nas respectivas bordas.
- Matriz `Collision` do Tiled: 264 células de água bloqueadas, 336 de chão livres; sem exceções nos limites. O Node faz `worldY = 19 - rowTiled`; Unity faz `blocked[x, 19-rowTiled]`. O componente `PlayerController` envia passo e **só atualiza transform após ACK** de `PositionHandler`; não há movimentação de cliente que ignore o bloqueio.
- Cena versionada: `Grid` em (-0.5,-0.5), `Grid/Tilemap` local (0,0), Grid 1×1 e `TileAnchor` (0.5,0.5). Logo `Tilemap.GetCellCenterWorld(x,y)` deveria ser (x,y) e coincidir com `PlayerController.transform.position` nos ACKs.
- Sprites lidos diretamente no GitHub: Grass1-Dirt1 32×160 (5 slices de 32), Water2 256×160 (40 slices de 32). Os índices 32..39 usados no Ground (GIDs 68..75) são a última linha de água do PNG e o `.meta` do Unity registra os cortes nessa linha. PPU=32 e pivot 0.5; **não há evidência estática de erro no recorte que produza deslocamento geométrico de 1 sqm**.
- Os quatro limites lógicos e suas cores deveriam coincidir matematicamente. O relatório visual do usuário **não corresponde às coordenadas previstas no repositório**. Não atribuir automaticamente causa a `Collision`, recortes, câmera ou posição salva. Possibilidades a diferenciar com evidência de runtime: a cena/asset local diverge da `dev` versionada, múltiplos layers/objetos sobrepostos, percepção visual pela silhueta/pivô do sprite, ou discrepância efetiva entre `Tilemap.GetSprite/GetCellCenterWorld` e `PlayerController.position`.

### Instrumentação segura (PR de diagnóstico)

O `TiledMapRenderer.cs` recebe ferramentas **somente no Editor**, `#if UNITY_EDITOR`, sem mudar regras:
- Checkbox `Show C1 Border Gizmos` no componente `MapManager > TiledMapRenderer`, dentro de Play Mode. Com Scene View (ou Game View com Gizmos habilitado), desenha quadrados **verdes** nas células caminháveis e **vermelhos** nas células bloqueadas, amostrando os quatro limites. Marca o pivô real do jogador com esfera **amarela**.
- Menu do componente (três pontos) → `C1 QA - Registrar alinhamento das bordas no Console`. Imprime a posição atual do jogador, `WorldToCell`, `GetCellCenterWorld`, transform de Grid e Tilemap, TileAnchor; depois, para 8 células, imprime GID real do JSON, `Collision`, `GameManager.IsTileWalkable`, nome do `Sprite` que a Tilemap desenha e centro efetivo do tile.
- Os valores que **deverão** aparecer se for usado o mapa da dev:
  - `(3,10)` chão, `(2,10)` água; `(26,10)` chão, `(27,10)` água;
  - `(15,3)` chão, `(15,2)` água; `(15,16)` chão, `(15,17)` água.
- Teste automatizado do backend valida **TODAS** as células de limite em X e Y, e novo contrato estático confirma instrumentos e sprites fatiados no Unity. Não dispensa execução no Unity real.

### QA necessário e como interpretar

1. Fechar Unity, preservar alterações locais de cena e `git pull` da nova `dev`; não restaurar stash antigo automaticamente.
2. Play Mode, selecionar `MapManager`, habilitar `Show C1 Border Gizmos` e ativar `Gizmos` na Scene/Game View. Levar o player às quatro bordas para identificar se o pivô **amarelo** ocupa um quadrado **verde** ou **vermelho**.
3. Quando o problema aparecer, clicar no menu do `TiledMapRenderer` > `C1 QA - Registrar alinhamento das bordas no Console` e compartilhar **apenas linhas `[C1 QA]`**, mais uma captura da Scene/Game View com os gizmos visíveis. Não incluir JWT, senhas ou string de conexão.
4. `collisionBlocked=true` com `unityWalkable=false` **e sprite azul de água** é bloqueio correto. Se o sprite parecer terra onde o gizmo vermelho está, é problema **visual de sprite/célula**. Se `WorldToCell` ou `GetCellCenterWorld` não combinar com o jogador, é problema **de transform/grade local**. Se os dados da cena local não conferirem, corrigir divergência de versão/stash antes de mexer no gameplay.
5. **Não ajustar Collision uma casa para mascarar a diferença, nem migrar posições SQL/spawns neste PR de instrumentação.** Corrigir somente após o resultado determinar a camada responsável.

Status: C0 encerrada; C1 em validação e investigação; C3/C8 independentes.

## C1 — Aceite visual e revisão final de spawns (31/10/2026)

### Evidência de aceite local
O desenvolvedor informou "Era isso mesmo, corrigido, podemos prosseguir" e forneceu diagnóstico [C1 QA] com Player world=(24,7), logicalCell=(24,7), WorldToCell=(24,7), GetCellCenterWorld=(24,7), Grid origin=(-0.5,-0.5) e TileAnchor=(0.5,0.5). Amostras das quatro bordas: chão collisionBlocked=False/unityWalkable=True; água collisionBlocked=True/unityWalkable=False. **Alinhamento visual e bloqueio de água validados no Unity.**

### Último bug: objetos Tiled com eixo Y invertido

**BUG P1 comprovado em MapLoader:** o desenho (Ground) e a matriz Collision já espelham a linha Tiled, que cresce para baixo, usando worldY = height - 1 - tiledRow. Entretanto PlayerSpawn, RespawnSpawn, MonsterSpawn e NPCSpawn usavam diretamente floor(obj.y / tileheight) como World Y. O resultado era posicionar os objetos do lado vertical oposto ao desenhado no Tiled.

**Correção mínima:** a conversão compartilhada dos objectgroups passa a usar x = floor(obj.x / tilewidth), y = height - 1 - floor(obj.y / tileheight). Não alterar os JSONs, sprites, Grid, Collision, lógica autoritativa de movimento nem dados SQL.

| Objeto no test-map 30×20 | Antes (Node antigo) | Após PR |
|---|---|---|
| PlayerSpawn | (15,3) | **(15,16)** |
| Goblin | (4,14) | **(4,5)** |
| Banker | (25,6) | **(25,13)** |
| Merchant | (25,14) | **(25,5)** |
| RespawnSpawn | Não existe no mapa atual | Y convertido em mapas que o possuírem |

**Proteção de persistência:** PlayerLoader preserva a última posição válida salva no PostgreSQL; não há migração ou reset de personagens. A mudança afeta o primeiro spawn de **personagens novos**, respawn após morte e as posições de NPCs e monstros no bootstrap. O teste de regressão garante que personagem existente na posição (15,10) permaneça nela mesmo após o PlayerSpawn mudar.

**Testes CI:** mapa real e mapa sintético assimétrico para todas as object layers; testes de NPC, respawn, colisão e personagem persistido ajustados. O backend roda os testes, mas a CI não executa Unity.

### QA necessário antes de fechar a C1

1. Após merge na dev, atualizar com git status e pull seguro; reiniciar o servidor.
2. Verificar que Teste Alfa e Beta voltam às posições **persistidas**, sem teleporte automático ao novo PlayerSpawn.
3. Verificar que o Node informa novo PlayerSpawn (15,16), Goblin (4,5), Banker (25,13) e Merchant (25,5).
4. Verificar no Play Mode que NPCs e monstros aparecem sobre o chão correto do Tiled e mantêm suas interações.
5. Com personagem novo **em banco descartável**, validar spawn em (15,16) ou próximo se ocupado. Não alterar contas reais só para testar.
6. Confirmar que água segue bloqueada nos quatro limites.
7. Após aceite local específico, marcar C1 concluída; prosseguir a C2 — Lifecycle/Entities, mantendo C8 com homologação integrada própria.
