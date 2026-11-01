# C11 — Bolsas aninhadas, NPC sob itens, loot por alcance e tema Obsidian & Bronze

**Data:** 01/11/2026. **Branch:** `feature/server-authoritative-containers-loot-c9`. **PR:** [#119](https://github.com/richzago/ZagoQuest/pull/119), Draft, sem merge em `dev`. Regressões reportadas durante a homologação C10.

## 1. Diagnóstico e correções

### 1.1 NPC sob item no chão

**Log do usuário:** `ShopErrorHandler: Comerciante inválido, sem itens ou muito distante`. Esse log provém da validação normal do Node, não de uma exceção C# nem de um crash fatal por si só. O NPC pode estar visível mas além de 2 tiles, morto, ocupado, sem catálogo ou com identidade divergente.

- `TargetSelector` mantém precedência de NPC sobre ItemOnGround quando os colliders se sobrepõem; não ignora os controles UI.
- `ClickInteract` compara a posição confirmada do jogador (pelo Node) com a posição do NPC antes de solicitar `openShop/openBank`; se distante, exibe `Aproxime-se do NPC` sem enviar pedido.
- `handleOpenShop` mantém a autoridade do Node e agora informa motivo distinto: NPC inválido, catálogo vazio, distância maior que 2 tiles, ou NPC ocupado. Registra `[SERVER LOG][NPC]`.
- `ShopErrorHandler` registra `Debug.LogWarning` e mostra resposta no Chat, sem usar `LogError` para uma recusa comum de gameplay.
- **QA pendente:** NPC sob item próximo e distante; NPC ocupado por outro player; loja e banco sem regressões.

### 1.2 Várias Bags iguais, aninhadas sem duplicação

C10 já atribuía UUID por Bag, mas a versão anterior do snapshot juntava todas com o mesmo `itemId` em uma linha com `amount: N`. Era impossível ao usuário abrir uma instância diferente da primeira; falhas de coleta na Bag equipada também precisavam de regressões.

- `Player.openNestedBag(itemId, instanceId?)` permite navegar somente para um filho **direto** da Bag atualmente aberta. `closeNestedBag` retorna ao pai; `viewedBagInstanceId` é separado de `equippedBagInstanceId` (navegar NÃO equipa e não altera equipamento).
- `getContainerCapacity` usa a Bag em visualização, mas **nunca concede slots se BACKPACK não está equipado**. Protege contra estado visual obsoleto. Uma Bag ocupa 1 slot do contêiner pai, mesmo que contenha itens em seus próprios slots.
- `attachGroundBag` valida alcance/capacidade e identidade **antes de modificar instâncias**; no rollback, elimina registros adicionados. O item no chão só desaparece após aceitação, via ACK do Node.
- `InventorySender` agora envia uma entrada para **cada UUID** de Bag, com `instanceId` e `amount:1`; consumíveis stackable continuam numa linha. O Unity preserva essas linhas em `InventoryHandler`, `InventoryUI.InventoryEntry` e `InventorySlot.BagInstanceId` (não colapsa UUIDs em um Dictionary para o desenho).
- Duplo clique em uma Bag abre seu conteúdo, **Backspace** retorna à Bag pai. O UUID também acompanha **equipItem** e **dropItem** quando originados de uma linha específica, para equipar/largar precisamente aquela Bag (não outra de mesmo itemId). UUID estranho é recusado sem mutar inventário. O servidor exige que a instância esteja presente como filho direto. A primeira Bag é a equipada; dentro dela podem ser abertas Bags, Bags dentro delas e assim por diante.
- Com a Simple Bag raiz cheia (10/10), novas coletas nela são recusadas sem perder o objeto. É possível abrir uma das Bags internas (com slots livres) e coletar outra Bag dentro dela.
- Mensagens `openBag` / `closeBag` tipadas e validadas estritamente por Zod; pedido `openBag` usa UUID opcional para compatibilidade com cliente C10, mas cliente C11 envia o UUID exato.
- Bags geradas como loot também recebem UUID próprio, não compartilham o conteúdo de outro item com mesmo ID.

**Importante:** não há suporte para CAP por peso ainda. No backend atual, `ItemType` **não possui propriedade weight**, e o player não calcula carga em pontos. A regra atual é capacidade por **slots**, obtida do `containerSlots` JSON da Bag em visualização. Implementar peso e carregamento máximo requer peso por tipo, fórmula por nível/vocação e validação comum em compra/loot/pickup; não afirmar implementação inexistente.

**Limite conhecido:** operações de inventário que originalmente exigem a Bag EQUIPADA (por exemplo, trocar o equipamento BACKPACK) devem ocorrer na janela raiz, depois de voltar com Backspace. A navegação aninhada usa uma janela de conteúdo por vez; não implementa ainda vários ScrollRects independentes para Bags de mesmo tipo simultaneamente. O sistema C10 de colunas continua em uso.

### 1.3 Loot fecha ao sair de perto

- `LootUI.Update` consulta a posição de tile confirmada pelo Node e o `CorpseIdentity` correspondente no `EntityManager` a cada 0,16 s. Distância Manhattan >2 fecha todas as abas locais do loot, sem tentar reabrir outros cadáveres distantes.
- `OnLootError` também fecha quando o Node responde `Too far from corpse`, `muito longe` ou `Corpse not found`.
- Fechar a janela **não remove cadáver nem loot do servidor**. O Node continua validando a distância em `handleLoot/handleTakeLoot`.
- Mantém histórico local LRU de até 4 cadáveres quando próximos.

### 1.4 Pegar Tudo: novo atalho

**Shift+L** com loot aberto, fora do chat e sem `TMP_InputField` focado. O atalho Shift+E foi removido por conflitar com o movimento. O botão compacto `TODOS` chama a mesma ação `TakeAllLoot`. Apenas o Node confirma a transferência; lote deve caber integralmente nos slots da Bag atual.

## 2. Tema original ZagoQuest — Obsidian & Bronze

**Referência visual consultada:** [Cyleria — atualização do cliente, 23/08/2023](https://cyleria.pl/?subtopic=update-03-08-2023). A referência demonstra UI escura, contornos de bronze/ouro, grade de equipamento compacta, barras superior/inferior e Backpack empilhada.

**Adaptação autoral, não cópia:** criamos `C11VisualTheme.cs`, paleta compartilhada:
- Background grafite quase preto, recuos cinza-ferrugem, painéis em 2 tons alternados;
- Contorno bronze discreto e texto marfim suave;
- Destaque frio azul-petróleo e estados hover/pressed;
- Marca `ZAGOQUEST • OBSIDIAN` no topo da sidebar;
- Moldura fina de cada item/slot; botões e painéis configuráveis usam o mesmo tema.
- Nenhum sprite, logo, ícone, textura ou arquivo do Cyleria foi copiado. Estilos aplicados em `C8SidebarShell`, `C8SidebarDynamicDock`, `C10ClientLayoutSettings`, `C6InventoryEquipmentLayout`, `WorldWindowLayout` e `InventorySlot`.
- A funcionalidade de até 3 barras por lado e faixas decorativas topo/centro/inferior para magias permanece, respeitando câmera única e adaptação de Game View.

## 3. Arquivos / contratos

Servidor:
- `server/src/game/entities/player.ts` (Bag equipada vs visualizada, opening por UUID, capacidade e rollback)
- `server/src/network/handlers/inventory.handler.ts` (openBag/closeBag autoritativo)
- `server/src/network/handlers/loot.handler.ts` (registro das Bags recebidas por loot)
- `server/src/network/handlers/shop.handler.ts` (erro de NPC detalhado)
- `server/src/network/senders/inventorySender.ts` (entrada própria por instância)
- `server/src/network/messages/{client,server}/inventory.messages.ts`, `messages/index.ts`, `validation/messageValidation.ts`, `handlers/index.ts`.

Unity:
- `Client/Assets/Resources/Scripts/NPC/ClickInteract.cs`, `Networking/Handlers/ShopErrorHandler.cs`
- `UI/LootUI.cs`, `UI/InventoryUI.cs`, `Player/InventorySlot.cs`
- `Networking/Senders/InventorySender.cs`, `Networking/Handlers/InventoryHandler.cs`, incoming/outgoing DTO
- `UI/C11VisualTheme.cs`, `UI/C8SidebarShell.cs`, `UI/C8SidebarDynamicDock.cs`, `UI/C10ClientLayoutSettings.cs`, `UI/WorldWindowLayout.cs`, `UI/C6InventoryEquipmentLayout.cs`.

## 4. Testes e CI

`npm test` contém `server/tests/c11NestedBagNpcLootUx.test.ts` com:
- NPC válido no mesmo tile de item; NPC distante recusado com motivo correto;
- segunda Simple Bag no chão com outra equipada; cópias de mesmo ID independentes;
- 10 Bags na Simple Bag e tentativa da 11ª (não despawna nem cria UUID). Abrir a Bag filha permite recolher a 11ª;
- navegação aberta/fechada e Zod rejeitando UUID/identidades inválidos;
- snapshot com várias Bags idênticas: cada uma com UUID, selecionável individualmente;
- contratos de Unity: nova tecla, alcance, mensagem amigável, identidade e tema.
- Integração C10 PostgreSQL continua coberta no job PostgreSQL.

**CI Node Windows/Ubuntu e PostgreSQL não compila C# nem renderiza Unity**. A cena e estilo são obrigatórios na homologação do usuário.

## 5. Checklist Unity obrigatório

- [ ] NPC com item sobreposto, a 1–2 tiles: abre Merchant/Banker. A 3+ tiles: mensagem informativa, não Debug.LogError.
- [ ] Abrir NPC ocupado por outro jogador: motivo `ocupado`; nunca abre loja indevidamente.
- [ ] Com Simple Bag equipada, coletar segunda Simple Bag do chão; chão desaparece só após ACK e Bag raiz mostra 2 slots distintos ao total (ou 1 filha + outros itens).
- [ ] Coletar duas/mais Bags iguais: cada uma visível como slot próprio, não só `xN`; abrir a primeira e a segunda mostra conteúdos independentes.
- [ ] Colocar itens dentro da primeira Bag interna, voltar com Backspace e abrir segunda: conteúdos não se misturam.
- [ ] Chegar a 10/10 na Bag raiz, tentar pegar outra: fica no chão. Abrir uma Bag filha vazia e pegar nela: sucesso.
- [ ] Logout/relogin com Bags aninhadas; conteúdo e UUIDs preservados.
- [ ] Matar monstro, abrir loot perto, afastar até 3 tiles: janela fecha automaticamente e corpse continua no mundo.
- [ ] Tentar pegar loot depois de afastar: Node rejeita; nenhuma perda ou duplicação.
- [ ] **Shift+L** e botão **TODOS** pegam tudo sem movimentar personagem. Com Bag cheia, falha atômica.
- [ ] Loja, pesca, combate, arrastar Bag equipada ao chão e recuperá-la: sem regressões.
- [ ] Configurar barras esquerda/direita, largura e modo compacto, testar 1920×1080 / 1280×720 / F10 100%–130%: Obsidian & Bronze, bordas/tipografia, botões e campos funcionais; sem cliques bloqueados no jogo.
- [ ] Confirmar que imagens e ícones do ZagoQuest são originais, não assets Cyleria.

## 6. Atualização local

Da raiz do repositório com alterações guardadas: `git fetch origin`, `git switch qa/containers-c9`, `git pull --ff-only`, conferir `git log -1 --oneline`. A C10 já exigia `Character.containerState`; **C11 não adiciona colunas novas**. Não executar `db:init:test` em banco de dados real. **Recuperar Bags com conteúdo do chão antes de reiniciar Node**, já que world items continuam em memória.

**PR #119 em Draft, NÃO MERGEAR sem autorização explícita do usuário.**
