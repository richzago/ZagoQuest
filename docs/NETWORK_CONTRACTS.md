# ZagoQuest — Etapa 1.8: Network Contracts

**Branch:** `fix/backend-network-contracts`  
**Base do PR:** `fix/backend-economy-interactions` (etapa 1.7).  
**Objetivo:** tornar explícito o formato das mensagens entre TypeScript/Node.js e C#/Unity; não mudar regras de combate, movimento nem persistência.

## 1. Por que contratos importam?

Em rede, **o JSON é o contrato**. TypeScript pode declarar uma propriedade que o servidor não envia, e C# pode esperar um campo diferente sem o compilador de nenhuma linguagem perceber a incompatibilidade. Resultado: a mensagem chega, mas o cliente lê um valor padrão incorreto.

Nesta etapa comparamos **senders reais**, interfaces TypeScript, DTOs C#, registro de handlers e UIs consumidoras. Não assumimos que uma interface representa fielmente o pacote.

## 2. Incompatibilidades reais corrigidas

| Pacote | Antes (declaração TS) | Wire format real e Unity | Correção |
|---|---|---|---|
| `bankWindow` | `inventoryGold` | `{ type, npcId, bankGold, gold }` | Interface TS passa a usar `gold` |
| `bankResult` | `inventoryGold` | `{ type, success, message, bankGold, gold }` | Interface TS passa a usar `gold` |
| `equipment` | `slots: Record<string, string|null>` | `{ type:"equipment", items:[{slot,itemId}] }` | Interface TS passa a usar `items` |
| `gold` | Emitido após operações, sem handler Unity | `{ type:"gold", gold:number }` | Agora atualiza somente o valor no inventário, sem apagar os itens |
| `attackFailed`, `pickupError`, `error` | Emitidos, mas sem handler Unity | `reason` ou `message` | Handler de feedback mostra informação no chat/Console |
| `autoAttackStarted`, `monsterDied` | Emitidos, mas sem handler Unity | `targetId` ou `monsterId` | Registra confirmações sem despawn duplicado |
| `stock=-1` | ItemSlot mostrava “Out of stock” | Valor negativo indica estoque sem limite | UI mostra “Estoque ilimitado” |

### Exemplos de payload (formato real)

```json
{"type":"bankWindow","npcId":"bank-1","bankGold":100,"gold":25}
```

```json
{"type":"equipment","items":[{"slot":"helmet","itemId":"equipment/armor/helmet"}]}
```

```json
{"type":"gold","gold":125}
```

**Observação:** `InventorySender.sendInventory` manda `{type:"inventory", gold, items}`; o pacote `gold` envia **apenas** o saldo. A UI não deve substituir o inventário quando chega uma atualização isolada de gold.

## 3. Novos comandos: fechamento explícito das janelas

A etapa 1.7 protegeu banco e loja por sessão de NPC e distância, mas clicar em **Fechar** no Unity apenas ocultava o painel. Como o servidor não recebia um comando de encerramento, a sessão continuava autorizada enquanto o jogador permanecesse perto do NPC.

Nesta etapa foram incluídos:

```json
{"type":"closeBank","npcId":"bank-1"}
```

```json
{"type":"closeShop","npcId":"shop-1"}
```

- **Unity:** `BankUI` e `ShopUI` guardam o ID do NPC cuja janela foi aberta e chamam os senders ao clicar em fechar. O painel ainda fecha imediatamente no cliente; não há nova janela/ACK do servidor.
- **Node:** ambos os comandos têm schemas Zod, tipos TypeScript e handlers registrados. Passam pelo mesmo rate limiter e fila ordenada da etapa 1.6.
- **Autorização:** `NpcInteractionSystem.closeIfActive(player, service, npcId)` revoga a sessão **somente** se serviço e NPC coincidirem. Comando atrasado de um banco não fecha uma loja aberta depois.
- **Protocolo antigo:** `openBank`, `openShop`, `deposit`, `withdraw` e `buyItem` continuam com seus campos originais.

### Por que o close inclui npcId?

Imagine um jogador abrindo uma loja após usar o banco. Por atraso na rede/UI, um `closeBank` antigo pode chegar depois. Se apenas chamássemos `NpcInteractionSystem.close(player)`, ele apagaria a sessão da **loja atual**, que não tem relação com o banco anterior.

```ts
const active = sessions.get(player);
if (active?.service !== service || active.npc.id !== npcId) return false;
sessions.delete(player);
return true;
```

Isso também impede que um `closeShop` destinado a outra loja apague a loja correta.

## 4. Type safety nos senders do backend

`BankSender` agora usa `satisfies ServerBankWindowMessage` / `ServerBankResultMessage`. `InventorySender` usa `satisfies ServerEquipmentMessage`.

Por exemplo:

```ts
const payload = {
  type: "equipment",
  items,
} satisfies ServerEquipmentMessage;
```

Se alguém modificar a interface exigindo `slots` e esquecer de mudar o sender, `npm run build` falhará antes de a alteração chegar ao Unity. `satisfies` checa a estrutura mantendo os tipos inferidos pelo compilador.

## 5. Testes

`server/tests/networkContracts.test.ts` cobre:
- captura real dos JSONs de banco, equipamento e gold emitidos pelos senders;
- existência de DTOs e handlers Unity para os campos e tipos efetivamente enviados;
- sincronização da quantidade de tipos aceitos pelo schema e handlers Node;
- validade de `closeBank`/`closeShop` e rejeição de ID ausente, extras e tipos incorretos;
- fechamento de sessão só pelo par correto serviço/NPC;
- correspondência dos novos senders C# e cliques de fechar nos painéis;
- interpretação `stock=-1` na UI.

A suíte de rede da etapa 1.6 também foi atualizada de **18 para 20 comandos** aceitos.

`server/tests/economySocket.test.ts` agora inclui integração real com WebSocket para:
1. Abrir banco → fechar → tentar depósito (recusado) → reabrir → depositar (aceito).
2. Abrir loja → receber `closeBank` antigo (ignorado) → comprar (aceito) → fechar loja → comprar (recusado).

Os testes de C# são **estáticos**: inspecionam os arquivos `.cs`, mas **não compilam Unity**. Uma compilação e smoke test no editor continuam necessários.

## 6. Validação local — Windows PowerShell

Estando na pasta `server/`:

```powershell
git fetch origin
git switch --track origin/fix/backend-network-contracts

npm ci
npm run build
npm test
```

### Smoke test manual do Unity

- [ ] Conferir compilação C# sem erros no Console.
- [ ] Conectar e receber `init`, inventário, equipamento e stats.
- [ ] Abrir banco, depositar/sacar: a UI deve mostrar os saldos corretos; o inventário não deve perder seus itens ao receber `gold`.
- [ ] Clicar em **Fechar banco**, tentar depositar por outro envio: operação deve ser recusada até reabrir.
- [ ] Abrir loja, comprar, clicar em **Fechar loja**, tentar comprar novamente: deve ser recusado até reabrir.
- [ ] Abrir banco, depois loja; fechar janela antiga não pode encerrar o novo serviço.
- [ ] Confirmar que estoque ilimitado aparece corretamente quando `stock=-1`.
- [ ] Testar erros `pickupError`, `attackFailed` e `error` no Console/chat.
- [ ] Testar loot, movimentação, spawn/despawn e HUD, verificando regressões.

## 7. Limitações documentadas

- O projeto **ainda não autentica a conexão WebSocket**. O primeiro socket recebe `world.players[0]`; não expor o jogo publicamente até implementar JWT/sessões.
- Os contratos C# usam campos `int` para gold; o backend limita gold a 2.147.483.647 no PostgreSQL, que cabe em `int`.
- A experiência (XP) é cumulativa e pode exceder `int` C# em longo prazo. A migração numérica de XP do Unity para `long` requer revisão coordenada do HUD/status e fica para uma etapa específica.
- `LootTakenHandler` ainda fecha a janela mesmo quando foi coletado somente um item. Atualizar a lista restante sem reabrir/consultar corpse exige um contrato adicional de loot; foi mantido fora deste escopo para evitar alteração indevida de UI.
- O envio de `closeShop`/`closeBank` é disparado pelos botões de fechar. Se a UI desaparecer sem passar por esses métodos (destruição da cena), o servidor ainda revoga por movimento, mudança de contexto ou desconexão.
- O processamento de rede não garante autenticação nem permissão por conta; a validação de campos não substitui autorização.
- As vulnerabilidades detectadas por `npm audit` serão abordadas no final da estabilização, conforme pedido.
