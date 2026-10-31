# Fase 5 — Matriz Network, handshake autenticado e roteiro de QA Unity/PostgreSQL

> **Status: em desenvolvimento / QA. Não concluído.** O protocolo autenticado é ativado com `WS_AUTH_REQUIRED=true` no ambiente de desenvolvimento. Em produção é obrigatório. Sem essa configuração, o modo legado local mantém os testes e o Unity atual. **Não publicar servidor legacy em rede aberta.**

## Matriz cliente → Node (validação Zod e handlers)

| Grupo | Mensagens | Validação | Handler |
| --- | --- | --- | --- |
| Autenticação, antes de qualquer gameplay | `authenticate {token,characterId}` | `z.strictObject` em `wsServer`, JWT HS256 e propriedade SQL `Character.id + accountId` | `authorizeCharacterSession` + carregamento do `Player` |
| Movimento | `move {x,y}`, `moveDir {dir}` | Tiles inteiros / direções enumeradas, sem confiar em destino | `move.handler.ts` |
| Combate | `attack`, `startAutoAttack`, `stopAutoAttack` | `targetId` validado, dano calculado no Node | `attack.handler.ts` |
| Chat | `chat {message}` | texto não vazio, até 500 caracteres | `chat.handler.ts` |
| Loot | `loot`, `takeLoot` | corpseId, itemIndex ou takeAll | `loot.handler.ts` |
| Inventário | `useItem`, `equipItem`, `unequipItem`, `dropItem`, `pickupItem` | IDs não vazios, quantidades positivas, coordenadas inteiras | `inventory.handler.ts` |
| Loja | `openShop`, `buyItem`, `closeShop` | NPC existente e proximidade, saldo/estoque no servidor | `shop.handler.ts` |
| Banco | `openBank`, `deposit`, `withdraw`, `closeBank` | quantidades positivas, sessão de banqueiro | `bank.handler.ts` |

Todos os comandos de gameplay são verificados em `network/validation/messageValidation.ts` e processados por `network/handlers/index.ts`. O pacote `authenticate` é exclusivamente de sessão e NÃO segue pelo registry dos comandos de jogo. Teto: **8192 bytes por frame**, **30 mensagens/segundo**, **32 comandos pendentes por socket**. Mensagens binárias, JSON inválido e comandos antes da autenticação são rejeitados.

## Node → Unity (contrato de recepção)

- **Novo:** `authenticated {characterId}`, enviado antes de `init` e snapshots. Não inclui JWT.
- `InitialStateSender`, `InventorySender`, `PlayerStatsSender` — próprios do personagem autenticado.
- `WorldStateSender` — monstros, NPCs, cadáveres, itens e **outros jogadores online**, nunca duplica o próprio avatar.
- `BroadcastService` — `spawn`, `move`, `damage`, `despawn`, `chat` para jogadores conectados; `sendToPlayer` entrega estado privado apenas ao UUID associado ao socket.
- Contratos de combate, inventário, economia, banco e loja permanecem com os senders existentes. A relação de tipos exatos deve ser atualizada quando forem adicionados novos handlers.
- **Limite de escopo:** ainda não existe filtro de viewport por cliente no broadcast: a transmissão usa todos os sockets autorizados. A segregação espacial será coberta em PR de viewport com Unity, não declarar concluído.
- O modo legado local continua sem autenticação por compatibilidade. `NODE_ENV=production` sempre exige JWT, independentemente da flag.
- No logout, primeiro remove registro de broadcast, espera fila do socket e grava personagem; o UUID só pode ser reconectado após o save, e o shutdown aguarda essas tarefas. O Player permanece no `World` durante a sessão de desenvolvimento para evitar perder estado caso o banco falhe; revisar liberação de memória/timers sob churn antes de servidor público.

## Unity QA — dois clientes

**Antes de qualquer teste:** backup do PostgreSQL e restauração em `zagoquest_test`, `DB_SYNCHRONIZE=false`. Para ativar WS em PowerShell no diretório server **somente na sessão de terminal**, sem persistir segredo:

```powershell
$env:NODE_ENV = "development"
$env:WS_AUTH_REQUIRED = "true"
# Certificar DB_NAME=zagoquest_test no .env privado.
npm ci
npm run build
npm test
npm run dev
```

**Configuração Unity (cena de QA):**

1. No `NetworkManager`, marcar `requireAuthenticatedSession=true`. Isso bloqueia auto-conexão até receber credenciais, sem gravá-las no Inspector.
2. Adicionar `SessionLoginDebugUI` a um GameObject ativo da cena. É UI de QA (IMGUI), não tela final de produção.
3. Com duas contas de teste diferentes, fazer login por `POST /api/sessions`. A UI recebe token na memória e lista apenas personagens da conta por `GET /api/characters/account/:accountId`. A lista REST agora inclui `id`.
4. Selecionar seu personagem. Unity envia `authenticate {token, characterId}` sobre a conexão WS aberta. Node valida JWT e propriedade no PostgreSQL e responde `authenticated {characterId}`. Só então o Unity marca `isConnected=true`.
5. Abrir dois clientes (editor + build ou dois builds) autenticados com contas/personagens DISTINTOS. Confirmar spawn, movimento do outro, chat, combate, inventário pessoal e gold privados.
6. Tentar usar token da conta A com `characterId` da B (via script de teste Node, não publicar JWT em logs). O Node deve fechar com código 1008.
7. Tentar dois logins no mesmo `characterId`: segundo deve ser recusado. Fechar o primeiro, confirmar save, reconectar, conferir posição/gold/XP.
8. Desconectar durante loot/combate/banco. Reabrir: entidades atuais não podem duplicar. Conferir cadáveres e itens persistentes em `WorldStateSender`.
9. Ctrl+C com dois clientes conectados. Aguardar mensagens de shutdown e reiniciar; confirmar `characters.posX`, `posY`, `gold`, `bankGold`, XP.
10. Repetir tentativas com token expirado e mensagens inválidas/spam. Não publicar tokens, senha ou dados pessoais no Console.

**Base de dados:** saves antigos com `accountId IS NULL` **não podem fazer login autenticado**. Não atribuir a conta do usuário sem processo explícito e auditado de migração de propriedade. Criar contas/personagens novos **na base de teste**, pela API autenticada. O login REST existente continua; sua refatoração profunda fica para a Fase 7.

## Testes automatizados

- `tests/characterSessionAuth.test.ts` — assinatura, expiração e propriedade da conta (PR #60).
- `tests/authenticatedWebSocket.test.ts` — sockets Node reais, dois players, ausência de snapshot antes da autenticação, token/personagem inválidos, duplicação, broadcast, logout, reconexão, dreno no shutdown (sem PG; injeção de serviço).
- `tests/networkSocket.test.ts`, `networkValidation.test.ts`, `networkContracts.test.ts`, `lifecycleSocket.test.ts` — payload, spam, comandos e cleanup legado.
- `npm run test:pg` da Fase 4 testa economia SQL real, **não** ainda duas sessões WS com banco real.
- **Ainda obrigatório para a saída da fase:** executar integração completa com **Unity + PostgreSQL** e duas contas no Windows do usuário, além de testar viewport, falhas de rede em instantes críticos e limpeza de timers sob muitas reconexões.

## Implantação incremental

- PR #59 e #60: integrados na `dev`, testados em CI (gold SQL/pg + autenticação independente).
- Este PR: mudança de protocolo **não deve ser mesclada até os testes Unity + PostgreSQL** com a nova UI. `main` intacta.
- Depois do QA: corrigir problemas reportados, CI Windows/Linux, merge para `dev` sem `force-push`. Documentar o commit final no checklist e auditoria Notion.
