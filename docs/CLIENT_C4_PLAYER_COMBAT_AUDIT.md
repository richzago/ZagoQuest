# C4 — Player/Combat: auditoria de input, movimento, target e morte

**Iniciada:** 31/10/2026 · **Branch:** dev · **Status:** C4 em andamento. Próxima fase após C3, por decisão expressa do desenvolvedor; **C5 será depois da C4**. A C3 tem teste Unity pendente do novo aviso de personagem já conectado (PR #93).

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
