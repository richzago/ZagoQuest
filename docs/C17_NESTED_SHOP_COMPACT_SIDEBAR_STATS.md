# C17 — NPC com Bags aninhadas, sidebar compacta e Stats

**Data:** 01/11/2026. **Base:** `dev` após [merge C16 #122](https://github.com/richzago/ZagoQuest/pull/122) (`4d02a8f`). **Branch:** `feature/c17-nested-purchases-compact-sidebar-stats`; [PR #123](https://github.com/richzago/ZagoQuest/pull/123) **DRAFT / sem merge**.

## 1. Origem do bug e decisão de design da loja

**Relato:** uma Bag aparentava estar lotada, mas o NPC ainda vendia potions. Algumas compras não apareciam nas Bags filhas vazias. O código anterior validava e escrevia na `player.inventory` (Map da janela **atualmente aberta**, não da árvore completa), permitia continuar empilhando em um slot `stackable` sem aplicar o `maxStack` e não selecionava uma Bag interna com espaço.

**Regra C17 adotada:** o NPC tenta colocar compras na **Bag equipada**, depois nas Bags descendentes conectadas por seus UUIDs. Faz busca determinística em largura; prioriza pilhas existentes que ainda comportem unidades, respeitando `maxStack` do item no JSON. Quando precisa de outra pilha do mesmo item, escolhe outra Bag conectada (a modelagem atual não comporta duas pilhas iguais dentro de um mesmo Map). Itens não-stackable podem ser divididos entre Bags conectadas respeitando slots físicos; Bags novas recebem UUID por instância no destino, mesmo que existam outras Bags idênticas.

- Tudo é planejado e validado no **Node antes** do débito, por **toda** a quantidade: item ofertado, preço, saldo, capacidade CAP (peso carregado inclui todas as Bags), slots livres na árvore, `maxStack`, integridade dos itens/filhos e inteiros seguros.
- Com espaço insuficiente para **qualquer** parte do lote, a compra inteira é rejeitada; nenhum item inserido e nenhum gold debitado. Não se devem criar itens escondidos em um inventário solto/desconectado.
- Na compra, o Node deduz primeiro ouro em mãos, depois do banco; se armazenamento falhar inesperadamente, repõe valores, conforme a proteção pré-existente.
- O fluxo inicial sem Bag continua permitindo comprar/equipar automaticamente a **primeira Bag**. Potions sem Bag equipada permanecem recusadas.
- Se a compra foi armazenada em Bag interna, o servidor envia aviso de que é preciso abrir essa Bag para visualizar.
- A navegação da UI pelo conteúdo da Bag não altera o destino de compra. Mesmo que o jogador esteja olhando uma Bag filha, a busca começa pela raiz equipada.
- O drop de Bag equipada ou filha com conteúdo permanece o fluxo server-authoritative já homologado na C14/C15, preservando UUID e árvore no chão após reinício normal.

**Limitação:** a estrutura atual é `Map<itemId, quantity>` por Bag. Ela representa uma pilha por `itemId` dentro de cada Bag, inclusive para itens `stackable`. A C17 aplica `maxStack` na **compra de NPC**, mas outros fluxos anteriores (loot, coleta, fishing) ainda podem armazenar quantidades acima de `maxStack`. A evolução correta é usar **slots físicos com pilhas independentes e IDs**, sem quebrar dados legados; recomendação C18/C19.

## 2. Sidebar visualmente compacta

Arquivos: `C8SidebarShell.cs`, `C8SidebarDynamicDock.cs`.

- Retirados rótulos redundantes `EQUIPAMENTOS`, `ACESSO RÁPIDO`, `CONTEINÊRES / LOOT`. Abas duplicadas `BACKPACK`/`LOOT`, botão `TODOS` extra e setas `< >` deixam de ser criados. O botão TODOS **real do Loot** permanece; os cadáveres podem ser reabertos por clique, e `Shift+L` continua autoloot 3×3.
- Quando Bag e Loot compartilham a mesma coluna, a janela aberta por último ocupa a área dinâmica; nas colunas separadas ambas podem existir. A Bag também pode ser trazida pelo pictograma da mochila, sem fechar a janela invisível ao primeiro clique.
- O minimapa **continua placeholder** (não é um minimapa funcional), mas área e círculo foram ampliados; equipamentos foram compactados, reservando a faixa de CAP e a área dinâmica. Há variante adicional para Game View baixa/F10 alto.
- CAP exibe `CAP 800` (apenas **capacidade restante**, sem `800/1200 oz`). Os dados continuam autoritativos via `C8SidebarShell.SetCapacity(remaining, maximum)` após os snapshots do servidor. Ao gastar ou largar peso, o número cai ou sobe conforme o peso efetivo.

## 3. Stats acessados por ícone

Arquivo: `StatusManager.cs`. Removido `InputAction("<Keyboard>/p")`; `P` deixa de abrir atributos. Pictograma `S` (`StatsIcon`) passa a ser botão real, com listener `TogglePanel`.

O painel de Stats real é **reparentado** para `SidebarDynamicHost`, responsivo, sem duplicação; recebe viewport com máscara e rolagem fina `C16FineScrollWheel`, compactação de textos e barras, nível/XP/vida/mana/ataque/defesa/armadura/pesca/saciedade provenientes dos snapshots do Node. Quando aberto, o dock oculta visualmente Backpack/Loot na mesma área, sem fechar seus dados no servidor. Ao fechar Stats, volta para a janela ativa. O logout continua fechando Stats.

## 4. Testes e observações

- `server/tests/c17NestedShopSidebar.test.ts`: 10 cenários para raiz cheia + Bag filha vazia, pilha parcial até `maxStack`, divisão entre duas Bags, Bag comprada com UUID, rejeição completa de árvore lotada, UUID órfão, CAP, reconstituição de árvore e contratos C# de UI.
- Atualizadas verificações históricas C6/C8/C9/C10/C11/C16 que exigiam aba ou status antigo. Isso não significa que testes antigos de gameplay foram desabilitados.
- **CI Node/TypeScript/PostgreSQL não compila C# nem executa o Editor Unity.** Validação visual e do evento de botão depende de Play Mode manual.

### Checklist de homologação Unity C17

1. **NPC + Bag raiz com slots cheios + filha vazia:** comprar potions, observar aviso sobre Bag interna, abrir a filha e conferir o lote; gold debitado apenas uma vez.
2. **Limite de pilhas:** comprar acima de `maxStack=10` quando só existe uma Bag sem filha: recusar tudo sem cobrar; com duas Bags, distribuir até 10 por Bag.
3. **Árvore inteira cheia:** tentar comprar poção e outra Bag; recusar sem cobrar saldo em mãos/banco nem criar itens invisíveis.
4. **CAP insuficiente:** recusar compra mesmo com slots internos vazios; ouro e todos os UUIDs inalterados.
5. **Bags compradas e drop:** comprar Bag aninhada, colocar itens dentro, largar no chão, recolher e abrir, inclusive reiniciar Node normalmente e verificar UUID/conteúdo.
6. **Sidebar:** sem palavras redundantes/abas, botões duplicados e setas; clicar monstro abre Loot, abrir mochila mostra Bag, TODOS **do Loot** continua utilizável, `Shift+L` permanece.
7. **Stats:** `P` não faz nada; ícone `S` abre e fecha atributos dentro da sidebar sem se sobrepor ao mapa nem a NPCs; rolar todo o painel e conferir valores do servidor. Interagir com Bag ou Loot após Stats.
8. **CAP:** somente número restante muda após compra, coleta, drop, troca de equipamento e ao ganhar level.
9. **Layouts:** 1280×720 / 1920×1080 e F10 100/115/130%; minimapa maior (placeholder), slots de equipamentos clicáveis, painel de Stats e Bag/Loot acessíveis, escala de texto legível.
10. **Regressões:** NPC longe não vende; banco/merchant, fishing, combate, loot, drag, reconexão e logout.

## Próximas melhorias candidatas

**P1 — integridade econômica:** atomicidade de save de personagem e chão PostgreSQL diante de crash abrupto, com tratamento anti-duplicação; testes de falha simulada. Este risco persiste desde C15.

**P1/P2 — pilhas físicas reais:** `container_items` modelando múltiplas stacks do mesmo itemId e posição por slot, unificação de `maxStack` em loja, loot, corpse, mundo e fishing, migração idempotente de saves legados, persistência de UUID da Bag.

**P2 — minimapa real:** substituir o placeholder maior por informações de terreno e posição/descoberta fornecidas de modo autoritativo pelo servidor, com otimização por viewport.

**P3 — qualidade de vida:** atalhos configuráveis, opção de altura/coluna por janela e histórico visual de loot sem criar dados no cliente.

**Governança:** [PR #123](https://github.com/richzago/ZagoQuest/pull/123) fica **OPEN/DRAFT sem merge** até QA local e autorização explícita.
