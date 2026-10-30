# ZagoQuest — Etapa 1.6: Network Validation

**Branch:** `fix/backend-network-validation`  
**Base:** `fix/backend-movement` (PR empilhado, não mesclar fora de ordem).

## 1. Por que este refactor?

Um `JSON.parse()` bem-sucedido só prova que a mensagem é JSON, **não** que seu conteúdo é seguro. Antes, qualquer cliente podia enviar propriedades inexistentes, strings onde se esperavam números, objetos onde se esperavam IDs, comandos desconhecidos ou pacotes excessivamente grandes.

Outra falha era o despacho `handlers[msg.type]` num objeto JavaScript comum. Chaves como `"constructor"` e `"toString"` podem corresponder a métodos herdados, não a handlers escritos pelo jogo.

Também identificamos ausência de controle de frequência, handlers assíncronos que podem terminar fora de ordem e múltiplos sockets associados a `world.players[0]`.

## 2. Pipeline de recebimento

```
Unity / cliente TCP WebSocket
   ├─ ws transport: maxPayload 8192 bytes, sem compressão
   ├─ rejeita mensagens binárias (close 1003)
   ├─ rate limiter: 30 mensagens / janela móvel de 1000ms
   ├─ JSON.parse (try/catch) → objeto desconhecido
   ├─ Zod discriminatedUnion: valida tipo e campos obrigatórios
   ├─ lookup seguro em handlers: hasOwnProperty
   ├─ fila assíncrona por socket: até 32 comandos
   └─ handler recebe ClientMessage validado
```

A fila serializa o processamento **por conexão** e não impede que outros sockets sejam processados em paralelo. Se um handler terminar lentamente, o próximo aguarda sua conclusão. Em caso de erro, o sistema registra falha e continua processando os próximos comandos.

### Tipos aceitos

`move`, `moveDir`, `attack`, `startAutoAttack`, `stopAutoAttack`, `chat`, `loot`, `takeLoot`, `useItem`, `equipItem`, `unequipItem`, `dropItem`, `pickupItem`, `openShop`, `buyItem`, `openBank`, `deposit` e `withdraw`.

São **18 tipos**, conferidos por teste com o registro de handlers.

### Regras dos campos

- IDs: strings não vazias, até 128 caracteres.
- Coordenadas: inteiros seguros, nunca strings ou frações.
- Quantidades: inteiros positivos e seguros, inclusive na loja e no banco.
- Chat: texto não vazio até 500 caracteres (limite por string).
- `moveDir`: apenas oito direções reconhecidas.
- `takeLoot`: `takeAll` booleano; `itemIndex` obrigatório quando falso.
- `dropItem`: `amount` opcional por compatibilidade com cliente legado; handler interpreta ausência como 1.
- Campos inesperados (ex.: `playerId` num comando de movimento) são rejeitados, não repassados ao jogo.

**Observação:** os handlers e sistemas de domínio continuam responsáveis pelas regras do jogo (distância, propriedade, colisão, estoque, saldo). O schema garante formato e tipos, não autorização.

## 3. Limites de abuso

| Limite | Valor | Reação |
|---|---:|---|
| Payload WebSocket | 8 KiB | WS fecha com 1009 |
| Pacote binário | Não aceito | WS fecha com 1003 |
| Frequência por conexão | 30/s | WS fecha com 1008 ao ultrapassar |
| Comandos pendentes por conexão | 32 | WS fecha com 1008 |
| Pacotes inválidos por sessão | 3 | Primeiro/segundo retornam `networkError`; no terceiro fecha com 1008 |

São limites **iniciais**, ajustáveis conforme testes reais no Unity. O WebSocket usa janela móvel por socket e `performance.now()` (monotônico), independentemente do cooldown de movimento.

## 4. Como o Unity recebe uma rejeição

`{ "type": "networkError", "message": "Mensagem invalida." }`

Foi criado `Client/Assets/Resources/Scripts/Networking/Handlers/NetworkErrorHandler.cs`, registrado no `PacketHandlerRegistry.cs`, que mostra a mensagem no Console. A resposta genérica não vaza detalhes internos do schema, e o servidor registra o motivo técnico.

## 5. Sessão e segurança: limitação importante

O servidor **continua SEM autenticação WebSocket**: hoje escolhe `world.players[0]`. Esta etapa impede que duas conexões simultâneas sejam associadas ao mesmo personagem, mas **não impede um cliente não autorizado de conectar primeiro**. Isso NÃO é segurança suficiente para publicar o MMORPG.

Um próximo trabalho dedicado a identidade/sessões deve validar tokens JWT, carregar o personagem autenticado, vincular socket e personagem e lidar com reconexões/expiração. Não confiar em `playerId` recebido do cliente. Até lá, manter o servidor acessível somente em ambiente local/privado de desenvolvimento.

## 6. Arquivos alterados (commits separados)

- `server/src/network/validation/messageValidation.ts`: Zod e parser seguro.
- `server/src/network/validation/messageGuards.ts`: rate limiter e fila ordenada.
- `server/src/network/websocket/wsServer.ts`: integra a camada de validação e limita conexões.
- `Client/.../NetworkErrorHandler.cs`: UI de aviso no console.
- `Client/.../PacketHandlerRegistry.cs`: registro do novo tipo.
- `server/tests/networkValidation.test.ts`: testes unitários de validação/abusos.
- `server/tests/networkSocket.test.ts`: integração WebSocket real com HTTP em porta aleatória.
- `server/package.json`: adiciona testes à suíte.
- `.github/workflows/server-check.yml`: CI da nova branch e PR empilhado.

## 7. Testes e validação

Dentro de `server/`:

```powershell
git fetch origin
git switch --track origin/fix/backend-network-validation
npm ci
npm run build
npm test
```

Os testes de rede cobrem pacotes válidos e inválidos, tipos desconhecidos e `__proto__`, campos extras, limites de strings e números, tamanho em bytes UTF-8, limites por segundo, execuções assíncronas em sequência, fila cheia, servidor WebSocket real, rejeição de outro socket, binário e frame acima do limite.

### Smoke test manual no Unity
- [ ] Conectar normalmente e receber `init`, inventário, stats e mundo.
- [ ] WASD e diagonais funcionam sem desconexões indevidas.
- [ ] Abrir NPC, comprar, depositar/sacar, interagir com loot.
- [ ] Enviar texto de chat normalmente; texto vazio não é aceito.
- [ ] Testar pacote inválido em desenvolvimento: Console Unity mostra `[NETWORK]`.
- [ ] Abrir segundo cliente simultâneo: deve ser recusado (limitação temporária).
- [ ] Fechar primeiro cliente e abrir de novo: reconexão normal.

## 8. Fora do escopo

- Autenticação/JWT de WebSocket, sessões por personagem e multiplayer real.
- Limites específicos por comando, IP, rota e políticas de proxy.
- Gestão completa do lifecycle de HTTP/WebSocket e shutdown.
- Testes de carga em milhares de conexões.
- Correção de dependências sinalizadas por `npm audit`, adiada a pedido do projeto.
