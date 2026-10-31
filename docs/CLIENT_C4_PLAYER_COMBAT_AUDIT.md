# C4 — Player/Combat: auditoria de input, movimento, target e morte

**Iniciada:** 31/10/2026 · **Branch:** dev · **Status:** C4 em auditoria aprofundada, **não encerrada**; C3 homologada pelo desenvolvedor (incluindo exclusividade por conta, PR #95). A primeira bateria local de C4 e PR #94 foram aprovados; nova correção incremental aguarda CI e QA Unity. **C5 será depois da C4**.

## 1. Escopo e premissas

- Arquivos Unity: Player/PlayerController.cs, Combat/TargetSelector.cs, Networking/Senders/MovementSender.cs, CombatSender.cs, Handlers/PositionHandler.cs, PlayerStatsHandler.cs, DamageHandler.cs, AutoAttackStoppedHandler.cs; HUD e TargetOutline.
- Contratos Node: MovementSystem, PlayerAttackSystem, AutoAttack, DeathSystem e eventos. O servidor segue authoritative para ritmo, colisão, dano, XP, morte e respawn; cliente só solicita comandos e mostra estados recebidos.
- Não alterar fase C1 (Tiled/Collision), C2 (Entity lifecycle), C3 (JWT/sessão), SQL ou main nesta primeira entrega.

## 2. Leitura atual da dev — evidências

- PlayerController usa oito InputAction (WASD + Q/E/Z/C). Update amostra IsPressed, permite no máximo um passo em voo por confirmação `position` ou timeout; manda `moveDir` sem prever deslocamento local. PositionHandler recebe o ACK e atualiza a posição autoritativa do jogador.
- PlayerStatsHandler sincroniza `moveIntervalMs` do Node com PlayerController, atualiza HUD/Stats; TargetSelector usa PlayerController para auto-follow, com resolução de cantos e stop de alvo enviado pelo servidor sem eco.
- C3 confirmou que um segundo socket não pode assumir o mesmo UUID; a guarda `isConnected` é essencial para impedir disparos durante handshake, recusa e reconexão.

## 3. Bugs, riscos e correção incremental

### P2 — InputActions do PlayerController sem Dispose e singleton sem limpeza

**Achado comprovado no código:** PlayerController cria oito InputActions no Awake, mas OnDestroy tinha apenas comentário `nada necessário` e não limpava Instance. Quando a cena é recriada, a referência antiga e as InputActions podem sobreviver ao ciclo esperado e dificultar reloads, especialmente com Domain Reload desativado. É um **bug de lifecycle/limpeza**, não uma falha de movimento reproduzida no teste local.

**Correção:** liberar todas as oito InputAction em OnDestroy, limpar Instance se a instância for a proprietária e proteger Enable/Disable com ?. para que uma eventual duplicata destruída no Awake não opere ações não inicializadas.

### P2 — TargetSelector podia enviar comandos sem sessão autenticada

**Achado no código:** SelectTarget enviava StopAutoAttack e StartAutoAttack diretamente via NetworkManager.Instance.Combat sem verificar conexão/sender. Cliques em Corpse e ItemOnGround usavam Inventory diretamente. Durante shutdown, desconexão ou sessão recusada, isso pode gerar NullReferenceException ou tentativa de comando em socket inativo. Como não houve reprodução local desse erro, classificar como **risco de crash validado pela inspeção de pré-condições**.

**Correção:** bloquear cliques no mundo enquanto não houver `NetworkManager.isConnected`, confirmar Camera.main, usar `Inventory?.` para loot/pickup e validar Network/Combat/EntityManager e targetId antes de SelectTarget. Manter limpeza de alvo permitida durante desconexão. Não alterar alcance, seleção, auto-follow ou regras do servidor.

### Riscos a verificar em C4, ainda sem correção

- Repetição de WASD sob latência ou perda do pacote `position`: o timeout local de 0,75s e o rate limit Node precisam manter sincronismo e evitar duplo passo.
- Retomar perseguição de criatura que foge com vida baixa, interromper ataque, trocar alvo durante movimentação; não reintroduzir bug de autoattack parado quando perde alcance.
- Dano/HP e barra de vida do jogador, morte/respawn Tiled (15,16), penalidade XP e seleção limpa após morte.
- Interações com chat aberto (InputAction não deve mover/atacar digitando); troca de cena e Play Mode com Domain Reload desabilitado.

## 4. Testes

- `server/tests/clientC4PlayerCombatContracts.test.ts`: valida Dispose/Enable/Disable para oito InputAction, singleton, guardas de sessão para ataque/loot/pickup, manter ACK de movimento e Stats do Node.
- Mantidos `clientSpeedContracts.test.ts`, `targetFollowContracts.test.ts`, `autoAttackTargetLifetime.test.ts`, `fleeChaseCombat.test.ts`, `playerDeathPosition.test.ts` e testes WS existentes.
- **Limite:** CI Node Windows/Linux/PostgreSQL não compila scripts Unity C# nem executa GameObjects. QA do Unity Editor/Windows Player continua necessária.

## 5. Checklist de aceite no Unity

1. Fechar Unity, preservar mudanças locais, atualizar dev após CI+merge; iniciar Node e sessão Teste Alfa; nunca reaplicar stash da cena sem revisar.
2. Entrar e sair do Play Mode 2–3 vezes. Console sem erros InputAction já descartada/nula; movimento funciona após cada entrada.
3. Segurar WASD e usar diagonais; cada passo só acontece após autorização Node; colisão água/parede continua intacta. Pressionar teclas enquanto digita no chat não deve mover.
4. Com Goblin distante, selecionar e perseguir; atacar, perder alcance, retomar, cancelar e selecionar outro alvo. Verificar stop no servidor e ausência de client-side movement não autorizado.
5. Matar Goblin, abrir corpse/loot, pegar item; HUD/HP/XP e respawn corretos. Após Beta morrer, renasce em (15,16).
6. Fechar a sessão Beta e clicar em monstro/corpse durante desconexão ou reconexão: não pode lançar NullReferenceException nem mandar pacotes antes do ACK.
7. Validar o aviso de personagem já conectado da C3: outro cliente com mesmo UUID recebe mensagem explícita, sem trocar controle da primeira sessão.

**C4 não concluída:** primeira correção incremental preparada, QA e fases restantes abertas. A C5 (NPC/World) começa após homologação C4.

## 6. Auditoria aprofundada após aceite C3 (31/10/2026)

### 6.1. Estado conhecido / fonte e nível de evidência

- **C3 CONCLUÍDA no Unity:** declaração explícita do desenvolvedor de testes OK, inclusive a nova regra de um personagem por conta. PR #95 na `dev` com CI pré e pós merge aprovadas.
- **C4 QA parcial APROVADA:** primeiro conjunto de correções (PR #94), respawn, combate e multiplayer funcional já relatados. Isso **não prova** todos os cenários de latência, desligamento e reload. C4 só termina após teste da entrega atual e cobertura dos casos críticos.
- **Código reavaliado:** `PlayerController.cs`, `TargetSelector.cs`, `PlayerHUD.cs`, `PositionHandler.cs`, `PlayerStatsHandler.cs`, `DamageHandler.cs`, `InitHandler.cs`, `AutoAttackStoppedHandler.cs`, `EntityManager.cs`, `MovementSystem`, `move.handler`, `PlayerAttackSystem`, `attack.handler`, `gameStarter`, `CombatSystem`, `CombatEventBridge`, `DeathSystem`, `PlayerStatsSender`.

### 6.2. Matriz Unity ↔ Node (sem mudanças de gameplay)

| Fluxo | Unity (emite/consome) | Node (valida/publica) | Resultado |
| --- | --- | --- | --- |
| Movimento manual WASD e diagonal | PlayerController -> MovementSender `moveDir`; PositionHandler recebe `position` | move.handler -> MovementSystem valida 1 sqm, diagonais sem corner-cut, cooldown e posição real; responde em movimento válido e recusado | Contrato coerente; sem bug demonstrado |
| Velocidade level/equip | PlayerStatsHandler -> `SetMoveIntervalMs` | getPlayerMoveIntervalMs: **75–150 ms**, item/level autoritativos | Limites compatíveis; manter |
| Auto-follow | TargetSelector chama RequestFollowTowards; PlayerController no máximo 1 passo pendente, fallback eixo após diagonal recusada | Movimento continua sujeito ao mesmo MovementSystem | Contrato coerente; confirmar com Goblin fugindo e cenário de latência |
| Seleção de monstro | TargetSelector -> `startAutoAttack(targetId)`; alvo pode ser distante | handleStartAutoAttack valida existência, vida/posições; não cobra distância na seleção | Decisão de gameplay intencional |
| Alcance e ataque | Unity envia comando, não escolhe dano | PlayerAttackSystem manual e tick automático compartilham **1,5 unidades e cooldown 1.000 ms**; CombatSystem define dano | Contrato coerente; não alterar |
| Dano e HP | DamageHandler atualiza barra de monstro/efeito; PlayerStatsHandler atualiza HUD do jogador | CombatSystem emite COMBAT_DAMAGE, CombatEventBridge emite 1 `damage`; playerStats dedicado quando jogador toma dano | Contrato coerente com testes existentes; observar efeitos no Unity |
| Fuga temporária | Alvo fica selecionado enquanto monstro está vivo, auto-follow tenta alcançar | gameStarter não encerra autoattack apenas por fora de alcance; retoma ao aproximar | Protegido por `autoAttackTargetLifetime.test.ts` e `fleeChaseCombat.test.ts` |
| Cancelamento | `ClearTarget` manda stop; `OnServerAutoAttackStopped` **não** ecoa stop ao Node | handleStopAutoAttack limpa alvo e retorna ACK com id anterior | Contrato coerente e teste existente |
| Morte do jogador | PlayerStatsHandler HP/XP; PositionHandler teleporte autoritativo; TargetSelector limpa seleção por `autoAttackStopped` | DeathSystem aplica penalidade XP, ressuscita em tile validado a partir do Tiled e envia stats, position e stop | Verificado por testes Node e logs anteriores de respawn (15,16) |
| Morte de monstro | EntityManager remove entidade, nameplate; Corpse aparece; alvo cancelado | DeathSystem processa morte uma vez, divide XP por dano, cria corpse e agenda um respawn | Testes backend existentes; QA cliente anterior positivo |

### 6.3. Achados deste PR

#### BUG P2 COMPROVADO — PlayerHUD singleton não é liberado

`Client/Assets/Resources/Scripts/UI/PlayerHUD.cs` tinha `OnDestroy()` vazio. Sua instância estática `Instance` permanecia apontando ao objeto destruído, enquanto o `Awake` do novo objeto apenas executava `Destroy(gameObject)` na duplicata sem `return`. Isso é especialmente relevante em reload de cena e quando o Domain Reload do Editor está desabilitado; pode causar `MissingReferenceException`, barras sem atualizar ou um singleton de UI que não responde.

**Correção mínima:** o `Awake` descarta a duplicata e retorna; `OnDestroy` faz `if (Instance == this) Instance = null`. Não altera valores de HP, mana, XP, layout, componentes ou prefab.

#### BUG P2 DE COMANDO COMPROVADO — troca para alvo inexistente envia STOP redundante

Em `TargetSelector.SelectTarget(string targetId)` o script anteriormente:
1. enviava `stopAutoAttack` para o alvo atual;
2. mudava `currentTargetId` para o alvo solicitado e tentava `GetGameObject(targetId)`;
3. se o monstro já tivesse desaparecido, chamava `ClearTarget()`, que enviava **outro** `stopAutoAttack` e descartava a seleção anterior.

O problema ocorre numa janela de corrida entre despawn e clique/seleção de monstro, ou com IDs obsoletos. Os dois STOPs são pacotes reais; se a seleção anterior estava válida, era interrompida sem necessidade. Não é a regra autoritativa de combate que falha, mas o comando enviado pelo cliente.

**Correção mínima:** verificar se `nextTarget` existe **ANTES** de encerrar o alvo antigo; se não existir, retornar e preservar a seleção. Se o ID solicitado é o mesmo já selecionado, não reenviar `startAutoAttack`. Só depois interromper antigo, atualizar os campos e iniciar o novo. `OnMouseClick` preserva o comportamento de clicar novamente no mesmo monstro para cancelar.

**Limitação:** a CI valida a ordem por contrato estático; o Play Mode deve reproduzir troca de alvo perto do despawn para confirmar que não aparece stop duplo. Não adicionar novos protocolos ou repassar decisões de combate para o Unity.

### 6.4. Classificação e prioridade (C4)

| Achado | Classificação | Gravidade | Situação |
| --- | --- | --- | --- |
| InputActions sem Dispose + seleção sem conexão | Bug de ciclo/risco de exceção | P2 | Corrigido PR #94; aceite local informado |
| PlayerHUD.Instance obsoleta após OnDestroy | Bug de lifecycle | P2 | Corrigido neste PR; QA local pendente |
| STOP duplicado ao selecionar alvo inexistente | Bug de comando | P2 | Corrigido neste PR; QA local pendente |
| Timeout follow 750 ms em latência alta | Risco a verificar | P2/P3 | Sem evidência de perda de passos; não alterar arbitrariamente |
| Ataque automático após perda temporária de alcance | Regressão crítica já tratada | P1 | Testes existentes protegem; QA Goblin fugindo |
| Alcance 1,5 e cooldown 1.000 ms | Decisão de design | — | Intencional, manter até nova especificação |
| XP proporcional ao dano, respawn Tiled | Decisão de gameplay | — | Implementada; manter |

### 6.5. Testes de regressão utilizados

Os novos testes em `server/tests/clientC4PlayerCombatContracts.test.ts` validam:
- `PlayerHUD.Instance` criado e liberado corretamente;
- status de HP, XP e nível continuam sendo renderizados a partir de `PlayerStatsData`, e não de estimativa local;
- seleção do próximo alvo antes do STOP anterior; nenhum START redundante e nenhuma perda da seleção ao alvo inexistente;
- contratos do servidor de `position`, `playerStats`, `autoAttackStopped`, alcance 1,5, cooldown 1.000ms, limites de 75–150ms e movimento após ACK.

**Regressões antigas mantidas:** `movement.test.ts`, `clientSpeedContracts.test.ts`, `combatEvents.test.ts`, `combatAutoRange.test.ts`, `targetFollowContracts.test.ts`, `autoAttackTargetLifetime.test.ts`, `fleeChaseCombat.test.ts`, `playerDeathPosition.test.ts`, `tiledRespawn.test.ts`, `conditionDeath.test.ts`, além da suíte de autenticação.

A CI em Node verifica contratos C# **por leitura de arquivos**, mas **não compila Unity nem valida efeitos visuais, input real ou ausência de alvos fantasmas**. Esses pontos exigem Editor e build Windows.

### 6.6. Plano de QA final do desenvolvedor — C4

**A. Setup e C3:** preservar alterações locais, atualizar `dev` e reiniciar Node; confirmar que o login normal funciona após C3 concluída. Usar contas/personagens de teste e build Windows atualizada.

**B. Movimento (Alfa):** testar segurar WASD, diagonais Q/E/Z/C, colisão água/paredes, mudança de direção rápida, digitação no chat sem movimento, andar com autoseguimento ativado/desativado. Observar posição no Node e no Unity. Não presumir teleporte do cliente.

**C. Seleção e combate:** selecionar Goblin a distância e aproximar; mudar de alvo enquanto outro monstro existe, clicar novamente para cancelar, clicar em alvo que desaparece (quando possível); confirmar apenas um START por alvo e que cancelar não causa loop de STOP. Atacar até HP baixo, deixar o Goblin fugir e verificar que a perseguição/autoattack continuam e o monstro pode ser morto sem precisar encurralá-lo.

**D. Dano, XP e morte:** verificar barra de vida do Goblin, dano flutuante, barra HP do jogador após apanhar, penalidade XP e renascimento em (15,16) ou célula caminhável próxima se ocupada, sem controle de alvo após morrer. Na morte de monstro, cadáver único e respawn sem alvo antigo persistir.

**E. Duas instâncias e lifecycle:** conectar Alfa Editor e Beta Windows, ver apenas um personagem remoto de cada lado; desconectar/reconectar Beta durante perseguição/combate; alternar Play Mode 2–3 vezes e verificar barras HP/XP atualizando, sem `MissingReferenceException`, `NullReferenceException` nem UI congelada. Fechar ambos e confirmar que Node remove as sessões.

**F. Distinção de QA:** reportar o que falhou com posição/ID do monstro, comando, Console Unity + log Node correspondente, sem JWT/senha; não confundir mudança de interface de loot (C6) com bug de combate ou a ausência de UI de pesca (C7).

**Critério para C4 CONCLUÍDA:** a matriz de input, alvo, auto-follow, dano/HP, morte/respawn e lifecycle foi exercida pelo desenvolvedor sem regressões impeditivas; CI verde e PRs integrados; documentação/Notion e riscos abertos devidamente identificados. Só depois abrir C5.
