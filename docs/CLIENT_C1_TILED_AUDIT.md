# C1 — Auditoria de Tiled, sprites, layers e colisão (31/10/2026)

**Fonte:** `assets/maps/test-map.json` (Node) e `Client/Assets/Resources/Maps/test-map.json` (Unity).
**Status:** inventário estático inicial concluído; **Play Mode e colisão do mapa ainda aguardam testes do desenvolvedor**.

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
