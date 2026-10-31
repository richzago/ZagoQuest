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
