# ZagoQuest — Etapa 1.7: Economy Interactions

**Branch:** `fix/backend-economy-interactions`  
**Base:** `fix/backend-network-validation` (PR encadeado).

Esta etapa é a **autorização de acesso aos serviços de NPC**, não uma reescrita dos cálculos econômicos. A Etapa 1.2 já protege quantidades, saldos, estoque e overflow; a 1.6 valida o formato do pacote. A lacuna era verificar **quem pode executar a operação e onde**.

## 1. Bugs reais encontrados

| Arquivo | Comportamento anterior | Risco |
|---|---|---|
| `bank.handler.ts` | `deposit` / `withdraw` operavam sem `openBank` e sem NPC próximo | Acessar o banco de qualquer coordenada |
| `shop.handler.ts` | `buyItem` validava comerciante e item, mas não proximidade nem loja aberta | Comprar em qualquer ponto do mapa |
| `shop.handler.ts` | `ItemRegistry.get` podia lançar ao mostrar item legado inexistente | Erro de handler e janela não enviada |
| `move.handler.ts` | Movimento não encerrava permissões de banco/loja (pois não existiam) | Usar janela antiga após afastar-se |
| `wsServer.ts` | Sem revogação de contexto econômico ao desconectar | Possibilidade de autorização sobreviver a nova conexão |
| `shopSystem.ts` | Comprar moedas abaixo do valor facial poderia creditar mais gold do que o pago | Gerar gold comprando moedas repetidamente |

## 2. Modelo de autorização de NPC

```
Cliente Unity                            Servidor Node.js
    |                                        |
    |  openBank {npcId:"bank-1"}             |
    |--------------------------------------->|  verifica mundo / tipo / distância
    |   bankWindow {npcId, gold, bankGold}   |  NpcInteractionSystem.open()
    |<---------------------------------------|
    |                                        |
    |  deposit {amount:30}                   |
    |--------------------------------------->|  getActive("banker")
    |                                        |  BankingSystem.depositGold()
    |  bankResult {success:true,...}         |
    |<---------------------------------------|
    |                                        |
    |  MOVE: afastou-se mais de 2 tiles      |
    |--------------------------------------->|  invalidateIfOutOfRange()
    |                                        |  revoke
    |  withdraw {amount:10}                  |
    |--------------------------------------->|  getActive("banker") => sem autorização
    |  bankResult {success:false,...}        |
    |<---------------------------------------|
```

A distância máxima é **2 tiles Manhattan**, a mesma já usada para `/hi`. Exige:
- NPC presente no `World` atual (pela referência, não somente ID de string);
- NPC correto (`banker` para banco, `merchant` para loja);
- jogador e NPC vivos;
- coordenadas inteiras válidas;
- distância máxima respeitada **em cada operação**, não apenas na abertura da janela.

O `WeakMap<Player, ActiveInteraction>` guarda no servidor qual serviço e qual NPC o jogador abriu. Um mesmo jogador só pode ter uma interação econômica ativa. Reabrir outra loja ou banco substitui a anterior.

### Por que não usar `npcId` no depósito?

O `BankSender.cs` atual envia somente:

```json
{"type":"deposit","amount":30}
```

Pedir um `npcId` adicional mudaria o protocolo do Unity sem necessidade. A sessão no servidor determina qual banqueiro está autorizando o depósito; o cliente **não escolhe** o banqueiro que autoriza cada transação.

`buyItem` já tem um `npcId`. Ele deve coincidir com o ID da loja que o servidor abriu antes; comprar por outro NPC é recusado.

### Limpeza da autorização

O `NpcInteractionSystem` revoga ao:
- afastar-se do NPC depois de um movimento aceito (`move` ou `moveDir`);
- detectar distância inválida, NPC removido, NPC morto ou jogador morto;
- tentar abrir um serviço ou NPC inválido;
- iniciar novo `/hi` ou enviar `/bye`;
- desconectar o WebSocket.

**Limitação do cliente atual:** os botões de fechar `ShopUI` e `BankUI` escondem a janela localmente, mas não enviam comando de fechar ao servidor. Até a etapa de contratos/revisão de UI, a autorização pode continuar ativa **enquanto o jogador permanece perto do NPC**. Isso não permite operação à distância; futuras mensagens `closeShop`/`closeBank` poderiam revogar imediatamente.

## 3. Segurança da economia

`ShopSystem.buyItem` agora rejeita moedas vendidas pelo NPC abaixo do valor facial.

Exemplo de exploração anteriormente possível ao configurar o NPC incorretamente:

```text
Valor de 1 platinum coin = 100 gold
NPC cobra:                1 gold
Jogador compra moeda -> adiciona 100 gold automaticamente
Resultado: 99 gold criados por compra
```

O guard de moeda impede esse caso, **sem** alterar a coleta normal de moedas do loot. Não implementamos um mercado dinâmico nem mudamos os preços atuais de `merchant.json`.

O estoque e a carteira/banco continuam sendo alterados atomicamente pelos métodos síncronos de `ShopSystem` e `BankingSystem`, como na Etapa 1.2.

## 4. Arquivos alterados

- `server/src/game/systems/npcInteractionSystem.ts`: novo serviço de autorização e revogação.
- `server/src/network/handlers/bank.handler.ts`: exige abertura de banco antes de depositar/sacar.
- `server/src/network/handlers/shop.handler.ts`: abertura e compra vinculadas à loja, com fallback seguro para nome de item legado.
- `server/src/game/systems/shopSystem.ts`: bloqueia moeda vendida abaixo do valor facial.
- `server/src/network/handlers/move.handler.ts`: revoga acesso quando se afasta.
- `server/src/game/chat/chatCommands.ts`: encerra autorização em `/hi` e `/bye`.
- `server/src/network/websocket/wsServer.ts`: revoga no evento de desconexão.
- `server/tests/economyInteractions.test.ts`: testes unitários + handlers.
- `server/tests/economySocket.test.ts`: testes com WebSocket de verdade.
- `server/package.json`: inclui novos testes.
- `.github/workflows/server-check.yml`: monitora branch e base do PR.

## 5. Como estudar o código

### `open()` — início do atendimento
```ts
NpcInteractionSystem.open(player, world, npc, "banker");
```
Revoga interação anterior. Valida localização, tipo e estado. Só então grava a autorização em `WeakMap`.

### `getActive()` — proteção de cada transação
```ts
const npc = NpcInteractionSystem.getActive(player, world, "banker");
if (!npc) {
  // Envia erro. Não chama BankingSystem.depositGold().
  return;
}
```
Revalida estado **no momento da operação**, mesmo que a janela tenha sido aberta anteriormente. Isso evita confiar em estado antigo.

### `invalidateIfOutOfRange()` — movimento
O handler de movimento chama essa função apenas depois de um passo realmente aceito. Um comando bloqueado não fecha a interação.

### Escopo da autorização versus sistema de domínio
`BankingSystem.depositGold` continua sendo uma operação interna do servidor, invocável por outros sistemas confiáveis. A autorização para comandos vindos de clientes pertence **ao handler WebSocket**, não ao domínio.

## 6. Testes e validação

Em `server/`:

```powershell
git fetch origin
git switch --track origin/fix/backend-economy-interactions

npm ci
npm run build
npm test
```

### Smoke tests no Unity
- [ ] Abra o banco perto do NPC e deposite/saque (saldos conferem).
- [ ] Tente abrir o banco de longe (servidor responde `bankError`).
- [ ] Abra loja perto do NPC e compre um item (gold e estoque conferem).
- [ ] Afaste-se do NPC com a janela ainda aberta e tente outra operação (recusa sem débito).
- [ ] Abra outra loja/banco e confira que a interação anterior fica inválida.
- [ ] Use `/bye` e tente depositar ou comprar novamente sem reabrir a janela.
- [ ] Feche o Unity/reconecte e confirme que o banco precisa ser aberto outra vez.
- [ ] Verifique se inventário, gold, XP, movimento e loot continuam normais.

## 7. Limitações e próximos passos

- **Ainda não existe autenticação WebSocket**. O primeiro socket continua associado a `world.players[0]`. Esta etapa protege os **serviços** contra acesso remoto, mas não autentica quem é o jogador. Não publicar o MMORPG na Internet ainda.
- Não há verificação de linha de visão (paredes entre jogador e NPC); alcance acompanha a regra atual de `/hi`.
- Painéis de banco/loja no Unity não enviam evento de fechamento explícito.
- Protocolo de rede completo, padronização de nomes/campos e sincronização Unity/Node ficam para a próxima Etapa 1.8 `fix/backend-network-contracts`.
- Vulnerabilidades das dependências (`npm audit`) ficam para a revisão final, conforme solicitado.
