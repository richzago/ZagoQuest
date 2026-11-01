# C14 — Bags recolhidas, CAP por peso e drop no campo de visão

**Branch:** `feature/c14-nested-bag-cap-visible-drop` (base `dev` após merge homologado da C13). **PR #120 DRAFT; não integrar antes de QA Unity.**

## 1. Bags de qualquer origem

Ao soltar uma Bag equipada no chão, o servidor transfere seu objeto de estado inteiro (`bagState`, UUID e filhos) para o item do mundo. Ao pegar o item com outra mochila equipada, a operação valida a árvore, a capacidade de slots no pai e o CAP calculado com todo o conteúdo oculto. O servidor só anexa o estado ao pai depois de creditar a unidade, preservando identidade e evitando contagem dobrada. Clique direito ou duplo clique num slot com `instanceId` deve chamar `OpenBag(itemId, instanceId)` no Unity, sem equipar outra bolsa de mesmo tipo.

## 2. CAP (server authoritative)

- `ItemType.weight` vem do JSON de cada item, por unidade em **oz**; quando o atributo está ausente ou é inválido, o peso conservador é **1 oz**, mantendo compatibilidade com assets legados. Moedas coletadas são convertidas em gold e não pesam na carteira.
- Fórmula provisória do personagem: **400 oz no level 1 + 10 oz por level adicional**. Apenas Node calcula; configurar curvas por vocação é evolução futura.
- O CAP inclui equipamentos, mochila equipada, itens em todas as Bags filhas e conteúdo não visível; navegar entre Bags não muda o CAP.
- `canAddItem`, `canAddItems`, `canCollectItems` validam peso (e a última, slots) antes de adição; compra e loot aproveitam a mesma validação. O pickup de Bag com conteúdo verifica **peso da árvore inteira** antes de modificar o mundo.
- UI: mensagem `inventory` inclui `capUsed`, `capMax` e `capRemaining`; equipamento exibe `CAP restante / máximo oz` numa faixa abaixo dos slots. A UI nunca decide aceitação.

## 3. Drop ampliado

- O Unity exige que o ponto esteja dentro de `Camera.main.pixelRect`; bloqueia localmente mais que **8 tiles X e 6 tiles Y** do personagem confirmado.
- O Node verifica a mesma janela autoritativa de **17 × 13 tiles**, bounds, `Tile.walkable`, entidades ocupando o destino e linha de visão de supercover. Paredes, água e obstáculos de colisão não podem receber arremessos; não atravessa paredes. A câmera com zoom diferente NÃO amplia o limite do servidor.
- **Somente alcance do destino do drop foi alterado**: interação com cadáver e NPC continua com raio de 2 tiles.
- Terrenos com regras mais finas que `walkable` (p.ex. proteção de zonas, superfícies lançáveis não caminháveis ou andares) exigem metadados Tiled próprios em outra fase.

## Limitações e QA

- Bags largadas no mundo ainda **não persistem após restart** do servidor, como no C13.
- O sistema segue sem transferência de item arrastado diretamente de uma Bag para outra. A navegação pelo clique foi melhorada, mas esse gesto será etapa separada.
- Os testes Node/contratos C# de `c14CapBagVisibleDrop.test.ts` não substituem a compilação/Play Mode Unity.
- Homologar: Bag antiga com itens → chão → comprar/equipar outra → recolher → clicar direito/duplo clique → verificar conteúdo e UUID; save/load com duas Bags; CAP cheio ao coletar, comprar e Take All; Bags pesadas no chão; drop até 8/6 em mapa com parede, água, NPC/monstro; F10 e 1280×720/1920×1080, interação NPC/loot e não-interceptação de UI.

## Decisões futuras

- CAP por vocação/atributos conforme design.
- Pesos de itens de pesca cadastrados em arrays JSON e política para IDs legados (o padrão de 1 oz está explícito).
- Persistir itens/contêineres no chão no DB com TTL e política de reset.
- Drag entre Bag A → Bag B com UUID de origem/destino, proteção de ciclos e transação.
