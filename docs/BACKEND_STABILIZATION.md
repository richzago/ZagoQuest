# ZagoQuest — Estabilização incremental do backend

**Referência:** `dev` no commit `02843ecd67ea54a4ecaede200410e3b1c6d89a2c` (30/10/2026).
**Escopo:** `server/src`. Cliente Unity fica em outra iniciativa.
**Status:** plano inicial — auditoria parcial do código atual; bugs devem ser revalidados na branch de trabalho.
**Princípio:** Entender → Identificar → Priorizar → Corrigir → Testar.

## Fluxo Git

- `dev`: integração do desenvolvimento existente.
- `refactor/backend-stabilization`: branch de integração da estabilização, criada a partir de `dev`.
- `fix/backend-xp-progression`: primeira tarefa isolada, com PR para `refactor/backend-stabilization`.
- Próximas branches: criar **somente quando iniciar cada tarefa** a partir da branch de integração atualizada; abrir PR pequeno; revisar e testar antes de mesclar.
- Não alterar `main` nem mesclar a iniciativa automaticamente.

## Etapas e checklist

### 0 — Base segura
- [x] Confirmar a branch ativa (`dev`, não `develop`) e o commit de referência.
- [x] Criar branch de integração e branch inicial de XP.
- [ ] Executar `npm ci && npm run build` em `server/` e registrar baseline.
- [ ] Adicionar infraestrutura mínima de testes (o `package.json` consultado não define `test`).

### 1 — Integridade das regras
- [ ] XP: unificar progressão entre `Player.addExperience` e `ExperienceSystem.addXp`; decidir explicitamente XP total vs. XP do nível; corrigir cálculos, eventos, atributos e persistência.
- [ ] Inventário/economia: rejeitar inteiros negativos, zero, frações, NaN, Infinity e overflow no domínio e nos handlers.
- [ ] Loader de monstros: eliminar `world.addMonster` e `spawnPoints.push` duplicados.
- [ ] Guildas: corrigir intervalo de `24 * 60 * 60 * 10` para 24h reais.
- [ ] Garantir atomicidade lógica de drop, pickup, loot, compra e venda.
- [ ] Verificar ataque automático — a versão atual tem uma chamada extra **comentada**, portanto não declarar duplicação ativa nesse loop sem reproduzir.

### 2 — Segurança e autoridade
- [ ] Movimento absoluto: rejeitar salto arbitrário para tile distante.
- [ ] Movimento direcional: limite de frequência e regras de colisão/diagonal.
- [ ] WebSocket: validação runtime dos comandos (Zod), limites e erros.
- [ ] Loja e banco: validação de quantidade, alcance e sessão de interação.
- [ ] Combate: consolidar alcance, cooldown e caminhos de morte.

### 3 — Protocolos e sincronização
- [ ] BankSender vs mensagem: `gold` / `inventoryGold`.
- [ ] Equipment sender vs mensagem: `items[]` / `slots`.
- [ ] Tipar Senders com `ServerMessage` (já existe union em `network/messages/index.ts`).
- [ ] Eliminar dano duplicado por broadcast e envio direto no ataque manual.
- [ ] Revisar snapshot inicial (cadáveres/outros jogadores) e mensagens de spawn.
- [ ] Definir associação segura socket → personagem (atualmente `world.players[0]`).

### 4 — Regras do gameplay
- [ ] Fluxo único para dano, morte, XP, loot, despawn e respawn.
- [ ] Efeitos de consumíveis e equipamentos no domínio, sem lógica duplicada.
- [ ] Chat local, interação com NPC e eventos enviados uma única vez.
- [ ] Revisar condições, skills e recálculo de atributos.

### 5 — Inicialização/persistência
- [ ] `worldFactory`: tratar falhas por etapa e evitar estado parcial.
- [ ] Validar JSON/Tiled e caminhos de assets com estratégia de build.
- [ ] Persistência de personagem, reconexão, autosave e shutdown ordenado.
- [ ] API: autenticação/autorização, `synchronize: true`, rotas e schemas.

### 6 — Qualidade e refatorações graduais
- [ ] Revisar responsabilidades de Player, Creature, World, GameStarter, Handlers e Senders.
- [ ] Reduzir `any`, imports dinâmicos, acoplamento com WebSocket e logs síncronos.
- [ ] Fazer mudanças arquiteturais **somente depois** de estabilizar regras essenciais.

### 7 — Validação final
- [ ] Build e testes de regressão.
- [ ] Cenários de XP, ouro, movimento, combate, loot, loja, banco, persistência e reconexão.
- [ ] Teste com dois clientes após autenticação de sessão multiplayer.
- [ ] Listar dívida técnica conscientemente adiada.

## Diagnóstico inicial da tarefa XP

Arquivos na `dev`:
- `server/src/game/entities/player.ts`: incrementa nível antes de subtrair XP exigido, usando custo do novo nível (erro).
- `server/src/game/systems/experienceSystem.ts`: no `addXp`, sobe nível sem subtrair XP; o mesmo saldo pode satisfazer vários níveis.
- `server/src/game/entities/creature.ts`: `xp` é alias getter/setter de `experience` — **não** são dois campos independentes.
- `server/src/game/systems/deathSystem.ts`: recompensa de monstro chama `ExperienceSystem.addXp`.
- `server/src/game/systems/databasePersistence.ts`: salva `experience` em `Character.xp`; atualizar/validar a semântica de dados.
- `server/src/network/senders/playerStatsSender.ts`: recálculo de stats no sender e campo `experienceToNext`; revisar depois junto ao contrato de XP.

**Condição para fechar a tarefa:** um nível e vários níveis com XP restante correto; XP inválido rejeitado; respeito ao limite de nível; atributos/eventos coerentes; persistência e HUD sem regressão.

## Critério de cada PR

1. Bug reproduzido (ou hipótese explicitamente classificada).
2. Comportamento esperado e regra definidos.
3. Teste que falha antes e passa depois, sempre que viável.
4. Mudança mínima, sem tocar sistemas sem necessidade.
5. Build, testes e smoke test do fluxo relacionado.
6. Revisão de impacto; PR é mesclado apenas depois de validação.

> Este documento não substitui auditoria integral, execução de testes nem conferência do cliente Unity. Resultados do estudo anterior podem estar desatualizados.