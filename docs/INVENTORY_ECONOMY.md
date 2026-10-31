# ZagoQuest — Etapa 1.2: inventário e economia

**Branch:** `fix/backend-inventory-economy` (empilhada sobre `fix/backend-xp-progression`).  
**Objetivo:** impedir criação/perda indevida de itens e ouro por parâmetros inválidos.

## 1. Regras de domínio

Arquivo: `server/src/game/systems/economyRules.ts`

- `isValidQuantity(value)` só aceita **inteiro positivo e seguro** (`Number.isSafeInteger`). `-3`, `0`, `1.5`, `NaN`, `Infinity` e strings são inválidos.
- `MAX_GOLD = 2_147_483_647`: limite do campo `INT` usado na persistência PostgreSQL.
- `canCreditGold(balance, amount)` garante que somar não exceda esse limite, sem modificar o saldo.
- `isValidItemId` impede IDs vazios ou objetos recebidos de mensagens JSON.
- `currencySystem` usa `hasOwnProperty`, não `in`, evitando tratar propriedades herdadas (ex.: `"toString"`) como moedas.

### Por que duas verificações?

O **handler** só recebe comandos; o **domínio** tem a regra de verdade. Se um comando futuro chamar `player.removeItem(itemId, -5)`, o método deve rejeitá-lo mesmo que o programador tenha esquecido de validar a mensagem.

## 2. Player: operações mínimas e testáveis

Arquivo: `game/entities/player.ts`

- `hasItem`: verifica quantidade positiva e saldo inteiro disponível.
- `removeItem`: primeiro valida via `hasItem`, depois subtrai. Nunca fabrica itens.
- `canAddItem`: *pré-validação* de espaço lógico/overflow antes de inserir um item; para moedas, verifica conversão em gold.
- `canAddItems`: pré-validação **do lote completo** de loot, somando itens repetidos e moedas de diferentes denominações.
- `addItem`: retorna `boolean` (`true` se realmente adicionou; `false` sem efeito). O antigo método não tinha retorno.
- `addGold`/`removeGold`: retornam `boolean` e recusam saldos inválidos, insuficientes ou acima do máximo.
- `unequipItem`: valida se é possível colocar o item de volta no inventário **antes de removê-lo do slot**.
- `equipItem`: tenta restaurar o item removido se a troca de equipamento falhar.

**Exemplo da falha antiga:** remover `-5` de uma pilha com `10` itens resultava em `15`. Agora `removeItem(itemId,-5) === false` e o saldo permanece `10`.

## 3. BankingSystem

Transferências são síncronas e seguem:

1. Validar quantidade inteira positiva.
2. Validar o saldo de origem e fundos disponíveis.
3. Validar o destino (sem overflow).
4. **Só então modificar os dois saldos.**

Exemplo: com 100 gold na carteira e 20 no banco, depositar 40 → carteira 60, banco 60. O total 120 é conservado. Se falhar qualquer verificação, ambos ficam iguais.

> **Fora do escopo atual:** validar que o jogador está perto de um NPC banqueiro e que abriu uma sessão de interação autorizada. Isso pertence à etapa de segurança e autoridade.

## 4. ShopSystem

Compras:
- Quantidade **explícita**, válida e positiva (sem `quantity=1` como fallback para pacote malformado).
- Preço inteiro não negativo fornecido pelo **NPC do servidor**.
- Estoque suficiente e válido; saldo total suficiente; inventário capaz de receber o produto.
- Desconta carteira primeiro, e banco depois; só reduz estoque após adicionar com sucesso.
- Se `addItem` falhar, devolve os valores cobrados.

Vendas:
- Validar quantidade, preço, posse real do item e capacidade de receber gold.
- Remover itens antes de creditar o produto da venda. Se não puder creditar, não vender.

> **Fora do escopo atual:** distância até NPC, controle de sessão da loja, economia de preços, controle de capacidade/peso do inventário e transações SQL distribuídas. Antes de admitir clientes multiplayer externos, revisar autorização do WebSocket.

## 5. Drop, pickup e loot

- **Drop:** valida quantidade, coordenadas finitas, limites do mapa e distância **antes de desequipar ou remover**. Um item equipado só pode ser dropado por esse caminho em uma unidade.
- **Pickup:** adiciona item ao jogador **antes** de removê-lo do mundo. Se falhar, permanece no chão.
- **Loot all:** verifica a capacidade do lote inteiro (inclusive moedas agregadas) antes de remover o corpse.
- **Loot individual:** valida o índice e só remove a entrada do corpo após a adição bem-sucedida.

> Ao permitir múltiplos clientes, controle de concorrência e identificação estável de item de loot ainda precisarão de revisão. Não são implementados locks/transações SQL nesta etapa.

## 6. Testes

`server/tests/economy.test.ts`: **20 cenários** cobrindo inventário, gold, banco, compra, venda, equipamento, drop, pickup e loot.  
`server/tests/experience.test.ts`: **13 cenários** para garantir que o sistema de XP não regrediu.

```bash
cd server
npm ci
npm run build
npm test
```

CI: `.github/workflows/server-check.yml` executa build e testes no GitHub Actions.

## 7. Critério para merge

- [ ] GitHub Actions verde, **33/33** testes passando.
- [ ] Revisão dos testes e do diff.
- [ ] Testar no Unity: equipar/desequipar, pegar/dropar, coletar loot, comprar, abrir banco, depositar e sacar.
- [ ] Verificar que o gold e os itens são preservados em logout/reconexão.
- [ ] Backup antes de testar com personagens/DB existentes.
- [ ] Mesclar XP primeiro, depois esta branch na integração.

### Dívidas técnicas mantidas de propósito

- `Player` ainda acumula várias responsabilidades; extrair inventário/economia para entidades próprias só quando necessário.
- `ITEM_PICKUP` ainda dispara em operações que não são coleta física (compra/equipamento). Revisar semântica dos eventos depois.
- Quantidade máxima por stack, peso/capacidade do jogador e persistência transacional são funcionalidades futuras.
- `ItemRegistry.get` pode lançar exceção para item inexistente; novos tratamentos pontuais foram aplicados, mas revisão geral virá depois.
- Guildas, NPC banker/merchant, contratos de mensagens e autoridade de gameplay terão tarefas específicas.

## 8. Atualização da regra Merchant — C5, 31/10/2026

**Esta seção substitui somente as antigas referências a estoque finito da seção 4 (registro histórico da primeira implementação).** Por decisão expressa do desenvolvedor, NPCs Merchant possuem **catálogo permanente, sem stock e sem redução por compra**. `ShopSystem.buyItem` mantém validações de quantidade, preço, saldo (carteira antes do banco), capacidade, moeda e rollback. `shop.handler` não expõe estoque, e `ShopItemSlot` oculta a label antiga do prefab. A propriedade `stock?` de `NpcShop.ShopItem` permanece temporariamente por compatibilidade com fixtures legadas, mas é **ignorada**. Testes passam a exigir compra além do antigo limite e consumo apenas de dinheiro/recursos do jogador. Banker mostra `Saldo no banco` e `Ouro em mãos` conforme resposta do servidor.
