# ZagoQuest C9 — Bag/Backpack via JSON, capacidade e coleta autoritativa

## Revisão de homologação pós-PR #119 (bugs reportados)

**Ver [C9_CRITICAL_HOMOLOGATION_FIXES.md](C9_CRITICAL_HOMOLOGATION_FIXES.md)** para diagnóstico, código afetado, semântica do novo comando `dropCorpseLoot`, recuperação da primeira Bag do chão, confirmação de origem `fromEquipment`, prioridade de clique NPC sobre itens, scroll 9–10, layouts compactos e checklist completo. Os testes manuais anteriormente anotados devem ser executados **junto com** a revisão de regressão.


> **Status:** PR de refatoração / homologação Unity pendente. Branch `feature/server-authoritative-containers-loot-c9` criada após merge autorizado #118 na `dev`. **Nenhum merge nesta etapa até novos testes do usuário.**

## Configuração por item (pedido explícito)

Cada Bag/Backpack determina sua própria capacidade em `server/src/data/items/equipment/backpack/*.json` pelo campo **`containerSlots`**, tipado em `server/src/shared/interfaces/item.interface.ts`:

```json
{ "id": "equipment/backpack/simple_bag", "name": "Simple Bag", "type": "equipment", "slot": "BACKPACK", "stackable": false, "containerSlots": 10, "bonuses": {} }
```

```json
{ "id": "equipment/backpack/basic_backpack", "name": "Backpack", "type": "equipment", "slot": "BACKPACK", "stackable": false, "containerSlots": 20, "bonuses": {} }
```

**Backpack avançada futura:** basta cadastrar seu JSON com `containerSlots: 40`. O Node consulta o catálogo via `ItemRegistry.get` **no momento da validação**, sem constantes de 10/20/40 na rotina do Player. Os valores de slot só se aplicam à Bag **equipada** no slot `EquipmentSlot.BACKPACK`. Nenhum usuário consegue alterar capacidade enviando mensagens do cliente.

| Contêiner | Slots | Merchant compra | Merchant venda |
|---|---:|---:|---:|
| Simple Bag | 10 | 20 gold | 8 gold |
| Basic Backpack | 20 | 35 gold | 15 gold |

## Regras, limites e compatibilidade

- Os itens continuam sendo armazenados no `player.inventory` persistido em PostgreSQL por `DatabasePersistence`. Essa migração **NÃO introduz inventários individuais independentes para múltiplas Bags**, nem novos registros no banco; **não prometer compartimentos separados nesta fase**. Preservar saves legados é prioridade.
- `Player.getContainerCapacity/getContainerSlotsUsed/canCollectItems`: calcula slots por JSON, considera pilha stackable como um slot por itemId e equipamento não-stackable por unidade; valida lote inteiro antes de coletar. Sem Bag equipada, o Node **recusa loot/cadastro do chão**, inclusive moedas, com mensagem legível e log `[SERVER LOG]`. Item existente em save legado permanece mesmo que o inventário exceda nova capacidade: nessa condição, novas coletas são recusadas sem excluir itens.
- A compra da **primeira** Bag ou Backpack no NPC Merchant pode autoequipar o item para permitir acesso à UI sem tecla I; o servidor envia `equipment` e novo snapshot `inventory`.
- Compra/venda e equipamentos existentes usam as rotinas atuais: capacidade nova é aplicada **à coleta de loot/chão**, ainda não é limitação geral de cada origem comercial. Evoluir depois com política de slots para banco/loja/trade.
- Servidor serializa `bagItemId`, `bagSlots`, `slotsUsed` em `inventory`. Unity lê os campos e apresenta contador da bolsa; nenhum cálculo autoritativo de slots ocorre no cliente.
- Atalho `I` removido; clique no slot `BACKPACK` (equipado) abre/fecha o inventário real. A aba `BACKPACK` também abre, quando equipado. Sem Bag, ela não abre.
- Loot: clique na linha solicita `takeLoot(corpseId,index)` como antes; drag da linha para a Bag usa a **mesma operação validada no servidor**; `Ctrl+Shift+L` faz `Take All` no cadáver atual (só fora de inputs). Botão `Take All` antigo é ocultado; loot não é removido sem ACK.
- Múltiplos cadáveres: lista local de IDs abertos e botões `<`/`>` para selecionar um deles, com novo snapshot por `SendLoot` a cada troca. O servidor ainda valida alcance e existência do corpo.
- UI: Bag e loot mostrados **simultaneamente** na coluna, Bag mais baixa com scroll. Botão Sair real agora é reparentado para o último ícone de Acesso Rápido, fora da área dinâmica; preserva seu listener original, sem alterar autenticação. Camera/TargetSelector/IsPointerOverUi intactos.

## Cuidados para futura fase de contêineres individuais

Para armazenar conteúdos diferentes em cada Bag específica será necessária identidade estável por instância, modelagem de `containerId`, estado/persistência da árvore de slots, migração segura de `Character.inventory`, transferências transacionais e suporte a itens contêineres aninhados (ou proibição explícita). Esta PR **não simula** essa infraestrutura no Unity e **não altera saves antigos**.

## Checklist de QA antes do merge

- [ ] Comprar Simple Bag (20g) no Merchant; verificar autoequip no slot BACKPACK, contador 0/10.
- [ ] Pegar itens do chão/loot sem Bag equipada: **falha informativa**, sem perder item ou alterar ouro, registro `[SERVER LOG]` no Node.
- [ ] Equipar Basic Backpack e verificar limite 20; alterar `containerSlots` em JSON de teste e confirmar que o Node usa o novo valor ao reiniciar.
- [ ] Pegar um item de cadáver com clique; confirmar ACK/índice correto, 2º/3º item sem erro.
- [ ] Arrastar item do loot até a Bag (incluindo slot com item) confirma coleta no Node. Arrastar para fora da Bag não deve autopegar.
- [ ] `Ctrl+Shift+L` pega tudo do cadáver atual **somente quando há espaço**, sem remoção parcial; sem bag ou bag cheia informa erro.
- [ ] Abrir 2 cadáveres; navegar com setas < >, selecionar um item, fechar um e retornar ao outro; respeitar distância.
- [ ] Tecla I não abre inventário; clique no slot BACKPACK e aba da coluna abrem/fecham.
- [ ] Bag e loot cabem juntos com scroll, inclusive 1280×720/F10 130%; nomes longos legíveis.
- [ ] Botão Sair como ícone de energia em Acesso Rápido, clicável sem cobrir Loot/Bag; logout/relogin não duplica.
- [ ] Primeiro clique monstro START, segundo STOP, cadáver loot, NPC, água à direita, pesca R permanecem.
- [ ] Deslogar com Bag equipada, reabrir o mesmo personagem e verificar inventário/equipamento preservados.

**A CI Node compila TypeScript e testa contratos do servidor, mas não compila C#/Unity e não garante layout visual. Aguarda autorização explícita antes de qualquer merge.**
