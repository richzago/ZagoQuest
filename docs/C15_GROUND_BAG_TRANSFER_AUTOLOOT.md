# C15 — Persistência de itens no chão, Bags e autoloot por maior hit

Data: 01/11/2026. Base: **dev** após merge [#120](https://github.com/richzago/ZagoQuest/pull/120) (C14 homologada), commit `4af9cd1`.
Implementação: `feature/c15-ground-persistence-bag-transfer-area-loot` / [PR #121](https://github.com/richzago/ZagoQuest/pull/121) **DRAFT**, não realizar merge antes de QA local.

## 1. Chão persistente

- `GroundItemPersistence` persiste todo item no `World.itemsOnGround` em `ground_items` (`world_key`, `id`, `payload jsonb`). Snapshot inclui `itemId`, quantidade, posição, nome e árvore `bagState` (UUIDs e filhos).
- `World.addItemOnGround` / `removeItemOnGround` notificam a fila de gravações. Uma transação SQL grava cada snapshot inteiro sem estados parciais de mundo; a fila serializa a ordem das atualizações. Durante o boot, o Node restaura itens antes do WebSocket/snapshot. No shutdown, aguarda escritas e grava snapshot final.
- Migration não destrutiva `GroundItems1793600000000` adicionada à lista versionada. `GroundItemPersistence.restore` executa `CREATE TABLE IF NOT EXISTS` para atualização segura de bancos existentes sem executar migrations antigas de baseline (que só são seguras em banco de teste vazio). NÃO rodar `db:init:test` em banco de jogador.
- O parser verifica IDs duplicados, quantidades e bounds; entradas inválidas não devem apagar silenciosamente o conteúdo persistido.
- **Limite importante:** gravação do chão e salvamento do personagem são persistências separadas. Embora mudanças do chão sejam enfileiradas imediatamente e o shutdown drene a fila, uma queda abrupta do processo entre o save de um personagem e o snapshot do chão ainda pode criar divergência. **Não anunciar atomicidade SQL entre inventário do personagem e chão.** Uma transação cruzando ambos será necessária antes de considerar economia anti-dupe completamente resiliente a falhas de energia.
- Política atual: itens no chão não têm TTL e sobrevivem ao reinício normal; por enquanto o mundo ativo usa `world_key=main`. Escalonamento multi-world e otimização de snapshots são futuros.

## 2. Transferência segura entre Bags

- Comando estrito `transferBagItem` com `sourceBagId`, `destinationBagId`, `itemId`, `amount` e `instanceId` só quando se move uma Bag. UUID de Bag é estável.
- O Node verifica se ambas as Bags são alcançáveis a partir da mochila equipada **do jogador autenticado**, posse e quantidade na Bag de origem, slots do destino, UUID específico para contêineres e nenhuma transferência para descendentes (ciclo), tudo antes de modificar os Maps. Não há `await` entre a validação e a mutação.
- No Unity, arrastar um item de um slot da Bag aberta sobre um slot de **Bag filha** envia `TransferBagItem`, sem otimizar UI. A rede devolve snapshot atualizado. A API permite movimentação entre UUIDs do mesmo dono mesmo quando não são visíveis simultaneamente; uma UX de duas janelas separadas e movimentações para o pai ainda exigem interface específica.
- **CAP não é alterado** pela transferência interna, pois o item continua carregado pelo mesmo personagem.

## 3. Scroll da Backpack e Loot

- `C8SidebarDynamicDock.EnsureVerticalScrollbar` cria barra vertical real com `Scrollbar.handleRect` arrastável; `ScrollRect` permite usar roda do mouse, barra e clamp com `scrollSensitivity=5f`.
- Viewport restringido para a barra não cobrir os itens clicáveis; conteúdo usa `ContentSizeFitter.PreferredSize`.
- UI é criada dinamicamente sem alteração manual da `scenebasic.unity`.

## 4. Autoloot pela tecla Shift+L

- `Shift+L` envia `{type:"autoLootNearby"}` mesmo com janela Loot fechada. **O cliente não escolhe cadáveres**, distância ou dono.
- O Node verifica a **box 3 × 3** centrada no tile confirmado do personagem (mesmo tile e oito vizinhos). Em cada monstro, a instância `Monster.maxHitByPlayer` conserva o **maior golpe individual efetivo**; `DeathSystem` grava `lootOwnerId` no corpo. Empate: maior dano total, depois UUID. O golpe final é informação separada.
- O comando só coleta corpos cujo `lootOwnerId` é o jogador autenticado. Faz validação de CAP e slots **por cadáver** antes de transferir o lote; não coleta parcialmente um cadáver sem capacidade. Outros cadáveres permanecem intactos. O botão TODOS da janela continua coletando apenas o cadáver aberto (fluxo manual existente).
- Corpos continuam expirando como antes (15 s padrão); autoloot não altera tempo de vida nem propriedade da XP.

## Testes automatizados e homologação

- `server/tests/c15GroundBagAreaLoot.test.ts`: ciclo/posse/UUID/slots, serialização e reconstituição de chão, maior hit, box 3×3 e CAP, contratos Unity e Zod.
- `phase4PostgresIntegration.test.ts`: caso real de gravação, restart lógico e remoção do item com UUID/conteúdo preservado.
- **Testes TS de contrato não compilam scripts C#**. É obrigatório executar Play Mode e abrir Backpack/Loot em diversas resoluções.

### Checklist de homologação Unity

1. Deixar Bag com itens e outra Bag dentro dela no chão, encerrar Node normalmente, reiniciar Node, entrar e recolher: UUID e conteúdo intactos.
2. Repetir com itens comuns empilhados, validar ausência de itens duplicados após dois reinícios; observar banco e logs.
3. Arrastar poções e Bags sobre uma Bag filha dentro da janela aberta; conferir visual/quantidade/UUID e voltar com Backspace.
4. Tentar mover uma Bag para ela mesma ou para sua própria descendente, tentar mover para Bag cheia ou de outro personagem: servidor recusa sem perdas.
5. Roda do mouse e arraste lentamente o puxador vertical em Backpack e Loot; primeiro e último item precisam ser clicáveis em 1280×720, 1920×1080 e F10 100/115/130.
6. `Shift+L` com loot fechado: recolhe apenas corpos na box 3×3 onde o jogador deu **maior golpe individual**; corpos de outros jogadores, distantes ou com CAP insuficiente permanecem.
7. Confirmações multiplayer, NPCs, pesca, movimento, loot manual, loja, logout, reconexão e troca de equipamentos.

## Pendências/risco técnico após C15

- Transação conjunta entre save do personagem e itens do chão para garantia anti-dupe diante de crash abrupto; recomenda-se dedicar etapa própria à integridade multi-entidade.
- Multi-world + TTL/operação escalável, parcelas de stack e UX com duas Bags abertas simultaneamente.
- Revisão da política de quem pode abrir/pegar loot manual de outros jogadores; C15 limita especificamente autoloot por maior hit.
