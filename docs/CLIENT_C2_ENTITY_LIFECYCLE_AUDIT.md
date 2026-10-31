# C2 — Lifecycle/Entities: auditoria, correções e QA Unity

**Data:** 31/10/2026 · **Branch:** dev · **Status:** C2 em andamento; primeiro conjunto de correções implementado e aguardando QA do usuário.

## Marco de entrada

A fase **C1 está concluída por aceite local do desenvolvedor**. Ele confirmou alinhamento do Grid, colisão água/terra nos 4 limites e os spawns corretos de Player (15,16), Goblin (4,5), Banker (25,13) e Merchant (25,5) nos logs do Node. A CI do PR #89 passou em Windows/Linux/PostgreSQL, e a validação local confirmou a configuração do mapa.

**Escopo C2:** EntityManager, MonsterIdentity, EntityIdentity, NpcIdentity, NameplateManager, TargetSelector, SpawnHandler/MoveHandler/DespawnHandler, snapshot e desconexão/reconexão. Não alterar C1, PostgreSQL, Tiled, autenticação, gameplay ou UX do loot nesta entrega.

## Fluxo examinado (código versionado)

`NetworkManager` conecta o socket e autentica cada personagem. O servidor manda `spawn` de cada entidade por ID estável. `SpawnHandler` distingue jogadores remotos (`entityType="player"`), itens e monstros/NPCs; `EntityManager` mantém `Dictionary<string,GameObject>`, rejeitando IDs repetidos. `MoveHandler` aplica posições do servidor; `DespawnHandler` remove o objeto e its nameplate; `NetworkManager.OnClose` limpa entidades antes de novos snapshots. `TargetSelector` manipula input, seleção e autoattack.

## Achados e prioridades

### BUG P1 — Identidade duplicada temporariamente no spawn do Goblin

**Comprovação:** `Client/Assets/Resources/Prefabs/goblin.prefab` já contém `MonsterIdentity`. Antes, `EntityManager.SpawnEntity` executava `Destroy(oldMonster)` e depois `AddComponent<MonsterIdentity>()` no mesmo frame; além disso, o script destruía qualquer `EntityIdentity` existente e adicionava outro. No Unity, `Destroy()` é adiado até o fim do frame, permitindo componentes duplicados e referências inconsistentes na criação.

**Correção:** buscar com `GetComponent<MonsterIdentity>()` / `GetComponent<EntityIdentity>()`; adicionar somente se ausente; preencher o ID do servidor sem destruir componentes existentes. Preserva o `MonsterHealthBar` e o prefab do Goblin.

### BUG DE CICLO DE VIDA / P2 — Singleton obsoleto ou duplicata inicializando

**Comprovação:** `EntityManager`, `NameplateManager` e `TargetSelector` destruíam um segundo GameObject no `Awake` sem retornar e não liberavam a referência estática `Instance` em `OnDestroy`. Isso é especialmente relevante para reabrir a cena, reload desativado ou objeto duplicado.

**Correção:** `return` imediato após destruir duplicata e `Instance = null` somente quando a instância destruída for a dona. O `TargetSelector` também libera os `InputAction` (`Dispose()`) quando destruído.

### RISCO COMPROVADO NO CÓDIGO / P2 — Destruição com CombatSender indisponível

**Comprovação:** `TargetSelector.OnDestroy` chamava `NetworkManager.Instance.Combat.SendStopAutoAttack()` apenas conferindo o manager e o alvo. Durante fechamento/reload, `Combat` pode ser null, gerando `NullReferenceException`, ou o socket pode estar encerrado.

**Correção:** enviar stop somente se o manager for dono da sessão conectada e `Combat` existir; evitar envio por uma instância duplicada sendo destruída. Isso não altera a lógica autoritativa de autoattack.

### MELHORIA DE ESTABILIDADE / P2 — Seleção persistindo se o dicionário estiver vazio

**Achado:** `ClearNetworkEntities` retornava caso `entities.Count == 0` antes de pedir a limpeza da seleção local. A seleção é estado separado do Dictionary.

**Correção:** chamar `TargetSelector.Instance?.ClearTarget()` **antes** de testar se o dicionário está vazio. `ClearTarget` não envia stop ao servidor quando a conexão já foi encerrada.

### Já protegidos pelo código e testes (revalidar no Unity)

- `SpawnEntity` e `SpawnRemotePlayer` não recriam IDs já presentes.
- `MoveEntity` atualiza a posição do objeto por ID; nameplate acompanha o alvo.
- `DespawnEntity` remove nameplate, texto de item, seleção e GameObject do Dictionary.
- `NetworkManager.OnClose` marca `isConnected=false` e chama `EntityManager.ClearNetworkEntities` antes do snapshot do novo socket. Mensagens de sockets antigos são filtradas por referência.
- Nenhum avatar remoto recebe `PlayerController` ou input próprio. Não alterar o contrato de autenticação de C0.

### Pendências de investigação C2 (não afirmar como bugs novos)

- Se itens e cadáveres continuam com seus textos, referências e colliders corretos após morte, loot, pickup e reconexão.
- Se snapshots e spawns repetidos chegam em condições de reconnect rápido, principalmente dentro do mesmo frame de `Destroy()`, e se o dicionário contém algum `GameObject` já destruído.
- Se o local de spawn, a barra de HP e o nome do Goblin permanecem corretos em respawn, sem UI órfã.
- Clicar/trocar o alvo durante a queda de conexão e após respawn, verificar ausência de `MissingReferenceException` e `NullReferenceException`.
- Outras questões de UX (janela Loot, pesca) ficam para C6/C7, não bloqueiam a correção técnica inicial C2.

## Testes de código e limites da verificação

`server/tests/clientC2LifecycleContracts.test.ts` está incluído em `npm test` e verifica o prefab real (MonsterIdentity pré-existente), a política de reutilização de IDs, o ciclo dos três singletons, liberação das InputActions, cleanup de target/nameplates/itens e os handlers de spawn/despawn. Os testes anteriores de reconnect continuam ativos.

**CI Node Windows/Linux/PostgreSQL não compila Unity** e não executa GameObjects. Este PR corrige bugs evidentes no código; a aceitação de C2 depende dos cenários de Play Mode abaixo.

## Roteiro de QA local para C2

1. Com Unity fechado, executar `git status`, preservar alterações locais (stash se necessário), `git fetch origin`, `git switch dev`, `git pull --ff-only origin dev`; **não restaurar stashes de cena sem revisão**.
2. No `server`, executar `npm run build` e `npm start`, usando banco de teste e autenticação já existentes; abrir Unity Editor na `scenebasic`.
3. Entrar como **Teste Alfa** e conectar **Teste Beta** em uma build Windows atualizada. O cliente deve desenhar **um** Goblin, **um** Banker, **um** Merchant e um avatar remoto por outra conta, sem duplicação de barra ou nome.
4. Atacar o Goblin; trocar de alvo, cancelar, matar, abrir loot e aguardar respawn. Verificar que não surgem `MonsterIdentity` duplicados no Inspector de uma instância e que a HP bar e seleção permanecem funcionais.
5. **Desconectar Beta** fechando o executável. No Editor, o avatar Beta e o nameplate correspondente devem desaparecer. Reconectar Beta; deve surgir exatamente **um** avatar com o mesmo nome.
6. **Interromper o Node com Alfa e Beta conectados**; no Editor, verificar a remoção das entidades remotas e dos nameplates/itens anteriores. Reiniciar Node, deixar a reconexão ocorrer e observar um único conjunto de entidades do mundo, sem `MissingReferenceException`, duplicatas nem estado de seleção fantasma.
7. Parar Play Mode, iniciar novamente e confirmar que nenhum singleton fica inválido; os movimentos do personagem continuam funcionando. Testar Windows build se houver mudança de comportamento específica do executável.
8. Registrar diferenças entre `spawn`, `despawn`, reconexão e renderização; enviar somente erros relevantes do Console e resultados, sem tokens/senhas.

**Critério para fechar C2:** nenhum GameObject/network ID duplicado ou persistente entre sessões, seleção/HP/nameplates atualizados e testes locais de desconexão/reconexão aprovados. As auditorias C3/C8 continuarão cobrindo autenticação e E2E completo.

## C2 — Aceite funcional e correção de pool de textos (31/10/2026)

**Aceite do desenvolvedor:** relatou "tudo certo, podemos prosseguir!" após testes Alfa/Beta, combate, morte e reconexão. Logs do Node: Beta morreu por Goblin, perdeu 2 XP, renasceu em (15,16) com HP cheio e Goblin perdeu o alvo. Logs Unity anexados: spawn de Beta, Goblin, Banker, Merchant e Corpse; despawn de Goblin e Corpse por IDs; Goblin novo com outro ID; despawn e posterior novo spawn do mesmo UUID de Beta, sem log de objeto duplicado.

**Limite da evidência:** logs não provam testes prolongados de reinício do servidor ou de reload da cena; estes seguem para C8. Posições de NPCs e Goblin na hora do spawn da rede podem variar do Tiled por movimento/AI.

### BUG P2 comprovado — FloatingText nunca retornava à pool

O arquivo do Console anexado registra repetidos avisos `[FLOATING] Pool vazio. Criando nova instância.` durante o combate. Causa exata na dev: o NameplateManager preenche uma fila com 10 FloatingText, mas Animate() terminava com Destroy(gameObject), sem chamar ReturnFloatingText. Após 10 hits, cada novo texto precisa ser instanciado. OnEnable também iniciava a coroutine antes de ShowFloatingText configurar texto/posição, exigindo StopAllCoroutines e reinício imediato.

**Correção:** FloatingText recebe referência do owner, devolve GameObject ao manager no fim, e não inicia Animate no OnEnable. ShowFloatingText configura posição, texto e owner, ativa o objeto e inicia uma única coroutine. Valida Camera.main antes de consumir a fila, ignora entradas destruídas e mantém expansão elástica para rajadas além de 10 hits simultâneos. Sem mudanças no damage packet, Node ou economia.

**Testes:** contratos C# estáticos da pool adicionados ao clientC2LifecycleContracts.test.ts, executados por npm test na CI. Não substituem a execução Unity. A confirmação local pontual pendente é bater no Goblin por mais de 20 hits e verificar que não aparecem avisos recorrentes de pool vazia nem erros de animação.

**Status:** C2 funcionalmente aceita para os cenários executados; correção do aviso P2 submetida com QA visual específico aberto. C3 iniciada em paralelo. C8 segue responsável pelos cenários E2E não demonstrados.
