# Fase 5 — Network, WebSocket e sessões autenticadas

Estado: **iniciada pela fundação de autorização**, não concluída. A partir da `dev` integrada `e14eb7d2`. A API REST permanece última área de refatoração profunda (Fase 7).

## Estado real do código

- `SessionService.login` em `POST /api/sessions` retorna JWT assinado com `{id: account.id, email}` e expiração 24 h.
- `authMiddleware` no REST já usa a identidade assinada para autorizar contas.
- `WebSocketServer` ainda usa `world.players[0]`, sem autenticação por conta/personagem; bloqueia segundo socket, mas **não** verifica JWT nem `Character.accountId` no PostgreSQL.
- O Unity `NetworkManager` conecta automaticamente a `ws://localhost:3000`, sem tela de login ou `characterId`; `Connect` reconecta em 2 s.
- `Character.accountId` é anulável no schema, e o `PlayerLoader` legado consegue criar personagem sem conta. **Não atribuir propriedade automaticamente a saves antigos.**
- `World.players` hoje comporta lista de players, mas o boot cria somente o personagem configurado no servidor. Fase 5 precisa ativar criação/carregamento autenticado por sessão e preservar invariantes de posição e UUID.

## Entrega deste PR (fundação sem quebra de Unity)

`authorizeCharacterSession(token, characterId)`, em `server/src/network/auth/characterSessionAuth.ts`, autentica JWT HS256 com expiração via `jwt.verify`, valida IDs UUID e consulta `characters` **com id do personagem + accountId do token na mesma condição SQL**. Retorna identidade autorizada ou `null`; falhas de PostgreSQL são propagadas para tratamento de indisponibilidade (não autorizam acesso). Consulta não modifica banco.

Regressões determinísticas: próprio personagem, personagem de outra conta, token adulterado/expirado, UUID inválido, falta de identidade no JWT e conexão PostgreSQL falha. A validação de identidade é um serviço independente, pronto para ser integrado ao handshake **em PR posterior**; neste PR o WebSocket legado ainda não foi alterado. Não marcar controle de sessão como concluído.

## Próximo PR técnico: protocolo autenticado

**Decisão proposta para contrato (exige teste Unity):** estabelecer uma fase de autenticação no começo da conexão WebSocket, antes de enviar estado inicial. O primeiro comando deve conter `token` e `characterId`, com limites de tamanho e tempo. Nenhuma mensagem de jogo pode ser processada enquanto não autorizada.

- Validar token com `authorizeCharacterSession`, checar proprietário e carregar o personagem correspondente (sem confiar em nome/position/gold do cliente).
- Rejeitar tentativa de conta alheia, credenciais ausentes/expiradas, personagem inexistente e dois sockets controlando o mesmo UUID.
- Preparar handshake e enviar `InitialStateSender`, inventário, stats e snapshot do mundo SOMENTE após autenticação.
- Assentar `session = { accountId, characterId, playerId, socket }` e proteger cada handler/queue.
- No logout, parar temporizadores do jogador, drenar handlers e persistir estado antes de remover do mundo; definir política de reconexão e sessão duplicada.
- No Unity, preparar fluxo login REST → selecionar personagem → enviar autenticação WS → receber snapshot; armazenar token **somente em memória** durante a sessão, nunca logar token/JWT nem gravar em PlayerPrefs sem decisão de segurança.
- Testar dois clientes, isolamento de viewport e movimentos, reconexão, morte, loot, banco e guilda, e shutdown com sessões simultâneas.

## Bloqueios e dependências

1. Fase 4: validar PR de consistência de gold em PostgreSQL de teste, inclusive cobrança REST online e autosave. Não liberar acesso público com fontes de estado divergentes.
2. Fase 4: migrations TypeORM versionadas, validação de JSONB legacy e rollback/concorrência PG ainda não foram comprovados. Esses itens não desaparecem por iniciar a Fase 5.
3. UI de login/seleção e fluxo do Unity ainda inexistentes; mudanças no `wsServer` devem sair em PR separado com testes de Node e validação no Unity antes do merge.
4. Back-end multi-instância, revogação de token/refresh e preparação de produção são decisões posteriores; o protótipo continua sem garantia de deploy público.

## Como validar este PR

Na raiz do projeto, com trabalho local preservado:

```powershell
git status
git fetch origin
git switch -c feat/phase5-character-session-auth-foundation --track origin/feat/phase5-character-session-auth-foundation
cd server
npm ci
npm run build
npm test
```

O PR não muda WebSocket nem Unity, portanto não exige teste visual imediato. Executar build e testes Linux/Windows na CI antes de merge. O PR de protocolo exigirá duas contas/players de teste no `zagoquest_test`, nunca testes destrutivos na base principal.
