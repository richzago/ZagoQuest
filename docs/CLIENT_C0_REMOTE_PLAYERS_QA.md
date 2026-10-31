# C0 — Multiplayer: identidade local x avatares remotos (31/10/2026)

## Relato e causa

**Relato do desenvolvedor:** duas contas diferentes, Teste Alfa no Unity Editor e Teste Beta em executável Windows, aparentemente controlam o mesmo personagem.

**BUG CONFIRMADO NO CÓDIGO DO CLIENTE:** o Node já registra clientes autenticados por UUID e envia `spawn`/`move` de outros jogadores, mas `Client/Assets/Resources/Scripts/Managers/EntityManager.cs` só instanciava monstros, NPCs, cadáveres e itens. Os nomes Teste Alfa/Beta não existiam em `prefabMap`, portanto o cliente **não criava um avatar para o outro jogador**. O mapa e o ponto inicial podem coincidir, fazendo a própria representação local parecer o único personagem.

**Ainda a verificar:** o relatório visual do usuário não prova sozinho que a API/servidor misturaram os UUIDs. A suíte WebSocket já testa isoladamente a identidade por sessão no Node, mas a reprodução com o Windows Player/Unity deve confirmar as duas identidades visualmente.

## Correção no PR

- O servidor anota `entityType: "player"` apenas no spawn de outro jogador (tanto snapshot inicial quanto broadcast de novo login); não infere o tipo pelo nome de personagem.
- `init` inclui `playerName` além do UUID, de modo que o HUD exibe o **nome do jogador autenticado** e serve de evidência visual para QA.
- `SpawnHandler` trata `entityType: "player"` separadamente e chama `EntityManager.SpawnRemotePlayer`.
- `SpawnRemotePlayer` cria um avatar **somente visual** via `GameObject`, `SpriteRenderer` e `EntityIdentity`, reaproveitando a sprite do personagem local e o nomeplate. **Não clona o GameObject Player, PlayerController, TargetSelector, Rigidbody2D ou InputActions**. Os `move`/`despawn` já existentes atualizam/removem esse avatar por UUID. A animação do remoto ainda é opcional para fase de polish.
- Proteção extra: se `init.playerId` divergir do `characterId` autenticado, o cliente recusa o init e encerra o socket sem liberar controle. Nenhuma credencial/token entra no log.
- Testes Node reais com dois WebSockets agora afirmam `init.playerId`, `playerName`, `entityType` e movimento independente de **Alfa e Beta nos dois sentidos**, além de contratos estáticos do Unity.
- Sem migração SQL, sem reset, sem alteração de `main`, sem reestruturar `scenebasic.unity`. Stash local do usuário permanece intacto.

## QA — execução obrigatória Unity Editor + exe

1. Encerrar Play Mode/Unity e Node; `git status`; preservar eventuais arquivos Unity locais em stash sem usar `git reset --hard`.
2. Atualizar `dev` (`git fetch origin && git switch dev && git pull --ff-only origin dev`).
3. `cd server && npm run build && npm start`. Conferir `WS_AUTH_REQUIRED=true` e database de testes.
4. **Rebuild do executável Windows** (uma build anterior NÃO contém o código corrigido). Scene List: `Assets/scenebasic.unity`.
5. Executar **Teste Beta no .exe** e **Teste Alfa no Editor**. Os nomes no HUD devem ser diferentes: `Teste Beta` e `Teste Alfa`, respectivamente. Não compartilhar token/JWT ou senha com logs.
6. Posicionar as duas instâncias em tiles diferentes, se estiverem sobrepostas, para observar o sprite e o nameplate `RemotePlayer_...` de cada um.
7. Andar com **Alfa** e verificar no **Beta** que somente o avatar remoto Alfa se move, sem movimentar o próprio Beta. Inverter o teste. Verificar que HP/inventário e chat/ação privada não espelham estado da outra conta.
8. Desconectar Beta: no Alfa deve ocorrer despawn do remoto Beta; reconectar e conferir um único spawn. Reiniciar servidor e validar novamente.
9. No Console, procurar `[MULTIPLAYER] Jogador remoto criado: ...`. Em caso de falha, enviar apenas avisos relevantes, nome no HUD e posição — **não tokens**.
10. Verificar que o SpriteRenderer remoto está visualmente correto e que não há C# erros em Build Windows. Não afirmar testes de Unity por aprovação da CI Node.

**Critério para C0 homologada:** duas instâncias autenticadas, HUD com personagens distintos, dois avatares visíveis, movimento independente em ambas as direções, despawn/reconnect limpo e nenhum erro de build. Se algum item falhar, manter C0 aberta.

[Auditoria C0–C8 no Notion](https://app.notion.com/p/40aec07d7c4f818eac62d7d6a2b2d933)
