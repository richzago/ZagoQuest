# C3 — Network/Auth: auditoria de contratos Unity ↔ Node

**Iniciada em 31/10/2026.** C0 e C1 concluídas; C2 aceita nos fluxos testados pelo desenvolvedor, com correção P2 de pool FloatingText submetida para QA pontual. A C3 está **em andamento**, sem homologação nova de segurança ainda.

## 1. Fluxos e limites da etapa

- REST: login de conta via `/api/sessions`, obtenção de `characterId` selecionado na própria conta, envio de token apenas na memória (SessionLoginDebugUI).
- WebSocket: `authenticate` com token e characterId, `authenticated` do servidor, `init` com playerId correspondente e snapshot dos outros jogadores; bloquear comandos até ACK.
- Reconexão: criar nova WebSocket, impedir que pacotes de sockets antigos alterem a sessão, limpar entidades ao receber `OnClose`, não repetir credenciais inválidas em loop.
- Isolamento: duas contas diferentes controlam somente seus próprios UUIDs; segunda sessão com o mesmo UUID recusada; o cliente não deve assumir identidade de outro.
- Mensagens: comparar payloads em `server/src/network/messages` e `Client/.../Messages`, handlers registrados, tratamento de erros e validações de tipos/limites; não alterar contratos sem teste real.
- Produção vs desenvolvimento: em produção o servidor exige auth; em dev para QA autenticado usar `WS_AUTH_REQUIRED=true` e `requireAuthenticatedSession=true` no Unity.

## 2. Achados da primeira inspeção da dev

**Proteções já implementadas / cobertas por testes Node**

- WebSocket autentica antes de associar o player ao broadcast, reserva UUID para impedir dois sockets com o mesmo personagem e recusa comandos anônimos (código em `wsServer.ts`).
- Unity `NetworkManager` aguarda ACK `authenticated`, compara `init.playerId` ao UUID selecionado, filtra mensagens de socket antigo por `ReferenceEquals(_websocket,socket)` e fecha em 1008 sem repetição agressiva.
- `server/tests/authenticatedWebSocket.test.ts` verifica duas sessões distintas, impossibilidade de comando anônimo, duplicidade de UUID, logout e reconexão. Testes não garantem execução real C#.

**RISCO P1 A VERIFICAR — referências antigas em NetworkContext**

- `NetworkContext` expõe EntityManager, ShopUI e BankUI com propriedades que resolvem o singleton no instante do pacote, mas armazena GameManager, ChatUI, LootUI, TargetSelector, NameplateManager, InventoryUI, EquipmentUI, PlayerHUD e StatusManager apenas no construtor.
- Esse arranjo cria uma diferença de lifecycle: se uma UI é recriada depois da criação do contexto ou se Awake ocorre em outra ordem, alguns handlers podem manter `null` ou instância obsoleta. Não há prova local de falha, então não marcar como bug reproduzido antes de avaliar C3.

**RISCO P2 A VERIFICAR — troca de personagem em socket aberto**

- `ConfigureAuthenticatedSession` substitui token/characterId em memória e fecha o socket atual para reconectar. Avaliar troca rápida ou fechamento durante handshake; nenhuma conta deve receber snapshot ou controle da outra.

**RISCO / ESCOPO C8 — queda e retomada de servidor**

- O teste atual da C2 mostra despawn e novo spawn de Beta, mas não demonstra todos os estados durante queda completa do Node e reinicialização. Preservar QA E2E independente.

## 3. Ordem de trabalho

1. Auditar todas as dependências em NetworkContext e comparar comportamento em Start/Awake/OnOpen/OnClose. Corrigir referência obsoleta com PR pequeno e teste estático, se confirmado no contrato.
2. Auditar matriz de `PacketHandlerRegistry` versus mensagens Node (campos, quantidade, tipos, erros). Não reescrever protocolo sem necessidade.
3. Auditar as flags de autenticação, troca de characterId e bloqueio de comandos anteriores ao ACK, com testes Node e QA de 2 clientes.
4. Confirmar sessão A/B no Unity Editor + Windows Player, reconexão e perda voluntária de socket; não registrar JWT nem senha nos logs.
5. Separar o que pertence a C3 (Network/Auth) e C8 (homologação completa).

**Status C3:** em auditoria, ainda sem aceite local específico da fase.

## C3.1 — NetworkContext e ciclo de vida da UI: primeira correção

**Classificação:** risco técnico P1/P2 de inicialização de referências (não há reprodução local confirmada de handler perdido). Ao revisar o contexto atual da dev, EntityManager/ShopUI/BankUI já usavam propriedades dinâmicas; outros nove singletons (GameManager, ChatUI, LootUI, TargetSelector, NameplateManager, InventoryUI, EquipmentUI, PlayerHUD e StatusManager) eram capturados no construtor e podiam permanecer nulos ou destruídos se os respectivos GameObjects fossem criados depois ou substituídos.

**Alteração contida:** NetworkContext agora lê todos os managers pelo singleton atual ao receber cada pacote; NetworkManager permanece associado ao contexto da conexão. Não modifica o handshake, os UUIDs, tokens, WebSocket, mensageria, regras de jogo, autenticação do servidor ou PostgreSQL. Os handlers que já acessavam context.NameplateManager e context.EntityManager continuam com a mesma API.

**Teste C3:** server/tests/clientC3NetworkContextContracts.test.ts, integrado ao npm test, exige lazy lookup para todos os managers e as verificações de ACK de autenticação e de init correspondente ao characterId. Os demais testes de WebSocket autenticado seguem na suíte.

**QA específico:** conectar Alfa Editor e Beta Windows; conferir dano flutuante, chat, inventory, loot, HUD e shop/bank após login e após fechar/reconectar Beta. Em caso de recriação de UI (reload da cena), handlers devem obter a instância nova. A CI Node não compila Unity, então C3 permanece ABERTA até teste local.

## C3.2 — Mesmo personagem em dois clientes: feedback de login duplicado (31/10/2026)

**QA relatado:** o segundo cliente abre WebSocket e mostra `Handshake WebSocket concluído`, mas não entra, e a tela de login não informa o motivo. A primeira sessão permanece controlando o personagem. Isso é correto quanto à exclusão de sessões, mas falta feedback ao jogador (BUG P2 de UX/autenticação).

**Causa comprovada:** `wsServer.ts` já executa `ws.close(1008, "Personagem ja conectado.")` quando `duplicate(characterId)` detecta uma sessão ativa. `NativeWebSocket.OnClose` do Unity recebe um `WebSocketCloseCode`, não a reason textual; `NetworkManager` só gera warning genérico de `PolicyViolation`. A `SessionLoginDebugUI` guardava `status = "Conectando..."` sem ler motivo de falha do socket.

**Correção:** antes de fechar com código 1008, o servidor entrega uma mensagem não sensível `{"type":"authRejected","reason":"alreadyOnline"}` com callback de escrita concluída; só então fecha. Isso não autentica nem registra o socket rejeitado, não altera a primeira sessão e não revela token ou dados de outra conta. O Unity trata esse pacote **antes do bloqueio de mensagens pré-ACK**, exibe no Console e oferece na `SessionLoginDebugUI`: `Este personagem já está conectado. Desconecta a sessão anterior para entrar novamente.`. A recusa marca `_authRejected` para não iniciar tentativas automáticas infinitas. Outros erros de política continuam genéricos.

**Teste automatizado:** socket real em `authenticatedWebSocket.test.ts` comprova pacote `authRejected` antes do close 1008, sem `authenticated` e com uma sessão ativa; disputa simultânea de UUID também entrega o motivo ao perdedor. `clientC3DuplicateSessionFeedback.test.ts` protege o tratamento do Unity e o texto mostrado na UI. CI TS/PG não compila C#.

**QA Unity necessário:** autenticar Teste Alfa no Editor; tentar Teste Alfa em build Windows: segunda UI deve mostrar o aviso e não entrar no mundo; Alfa no Editor continua podendo andar. Fechar o primeiro, escolher o personagem novamente no segundo cliente e confirmar que entra após logout/salvamento. Testar Teste Beta simultaneamente para garantir que outra conta continua funcionando. Não registrar credenciais.

**Sequência do roadmap corrigida pelo desenvolvedor:** depois desta correção C3, **iniciar C4 — Player/Combat**, não C5. C5 — NPC/World permanece na ordem seguinte. A C3 tem QA pontual do novo feedback ainda pendente; C4 pode ser auditada em paralelo, sem declarar a C3 integralmente homologada até aceite do aviso.

## C3.3 — Exclusividade de sessão por CONTA, além do personagem (31/10/2026)

**Nova decisão de design do desenvolvedor, após QA da C3/C4:** mesmo quando personagens são diferentes, a mesma conta não deve controlar dois personagens simultaneamente. Contas distintas continuam podendo jogar juntas. O usuário validou os testes anteriores do cliente, inclusive o feedback `alreadyOnline`.

**Regra na autoridade do Node:** `authorizeCharacterSession()` comprova propriedade via JWT HS256 + SQL com accountId/characterId. `wsServer.ts` mantém `socketAccountIds` para slots de conta autenticados e `reservedAccountIds` durante handshake e salvamento final. Sem `await` entre teste e reserva do slot, dois logins concorrentes de personagens diferentes da mesma conta não conseguem autenticar ambos. Checar duplicação de characterId primeiro para manter o retorno específico antigo `alreadyOnline`; se apenas accountId duplica, enviar `authRejected` com `reason: accountAlreadyOnline` antes de WS close 1008.

**Fechamento consistente:** ao fechar socket associado à conta, reservar o personagem E a conta antes de excluir registros ativos; aguardar `OrderedMessageQueue.whenIdle()` e gravação `saveSessionPlayer` antes de liberar ambos os slots em `finally`, inclusive após falhas. Evita troca de personagem que leia/grave estado enquanto a sessão anterior ainda encerra. Tokens, IDs de conta e identidades de outros personagens nunca são enviados na mensagem de recusa. O modo legado local sem JWT continua isolado das restrições por conta.

**Mensagem Unity:** `Esta conta já possui um personagem conectado. Desconecta a sessão anterior para entrar com outro.` exibida em `SessionLoginDebugUI` via `NetworkManager.AuthenticationStatusMessage`, com o mesmo bloqueio de tentativas automáticas de reconexão já existente.

**Testes de integração com WebSocket real:** personagens Alice e Clara com token da mesma conta, Bruno com outra. Validar que Alice+C nunca se autenticam juntas, Alice+B coexistem, disputa concorrente Alice/C tem exatamente um vencedor, logout seguido de save libera entrada de Clara e save pendente impede entrada de Clara. Os testes anteriores de duplicação do mesmo UUID e isolamento A/B permanecem ativos. Testes estáticos de feedback C3 revisados para o novo método compartilhado de recusa.

**Limite de arquitetura:** slot é mantido em memória no processo do mundo Node atual (um servidor autoritativo). Para múltiplas instâncias ou shards distribuídos, um lock centralizado transacional ou Redis com TTL/ownership será requisito de escala futura — não implementar preventivamente neste PR.

**QA Unity ainda necessário:** com a conta Alfa possuindo personagens A e C, conectar A no Editor; tentar C na build Windows e receber aviso da conta ocupada, sem despawn de A; testar Beta de outra conta; sair de A e selecionar C, conferindo acesso após persistência. Validar o mesmo personagem continua mostrando a mensagem antiga. Não registrar JWT/credenciais.

**Andamento C4:** os testes Player/Combat foram aprovados pelo desenvolvedor em 31/10/2026; começar o aprofundamento técnico de C4 depois desta proteção, sem pular para C5.
