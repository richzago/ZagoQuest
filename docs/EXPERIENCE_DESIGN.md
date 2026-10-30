# ZagoQuest — XP cumulativo e progressão (proposta inicial)

## Decisão de design

A experiência **não é descontada** ao subir de nível:

- `Player.experience` / `player.xp`: XP acumulado atual que determina o nível. Pode sofrer a penalidade de morte.
- `Player.lifetimeExperience`: todo XP **efetivamente recebido** durante a trajetória, inclusive o perdido por morte.
- `Player.experienceToNext`: XP **total** necessário para chegar ao próximo nível (limite absoluto).
- `levelXp` e `levelXpToNext`: apenas o avanço no nível atual, enviados ao Unity para preencher a barra corretamente.

Exemplo: personagem de level 1 com 90 XP mata Rat de 4 XP três vezes → 94, 98, 102 XP. Ele sobe para level 2 **com 102 XP**, e o próximo objetivo será 230 XP.

## Curva editável

Arquivo: `server/src/data/experience/experienceConfig.ts`.

```ts
const n = level - 1;
const totalXp = 100*n + 15*n*(n-1) + Math.floor(n**3/800);
```

Parâmetros:
- `base:100` assegura que level 2 exige 100 XP.
- `growth:15` controla a progressão nos níveis baixos e intermediários.
- `curveDivisor:800` controla a dificuldade em níveis altos: **menor divisor = mais XP necessário**.
- `maxLevel:5000` é um teto técnico temporário. O maior requisito é 531.431.198 XP, adequado ao `int` do PostgreSQL usado em `Character.xp`.

| Level | Tibia: XP total | ZagoQuest: XP total |
|---:|---:|---:|
| 1 | 0 | 0 |
| 2 | 100 | 100 |
| 3 | 200 | 230 |
| 10 | 9.300 | 1.980 |
| 50 | 1.847.300 | 40.327 |
| 100 | 15.694.800 | 156.642 |
| 3.500 | 713.359.324.800 | 237.490.255 |
| 5.000 | 2.080.834.749.800 | 531.431.198 |

**Importante:** XP menor não significa necessariamente evolução mais fácil. Dificuldade é proporcional à razão `XP para subir / XP por monstro / tempo de caça`. Pretendemos ~20–25% mais abates/tempo que Tibia em caçadas equivalentes, mas **isso ainda precisa ser balanceado** por faixa de nível e criatura.

Como primeiro ajuste, Rat passou de 15 para **4 XP**: são 25 Rats para atingir os 100 XP iniciais (contra 20 Rats com 5 XP base no Tibia). Goblin e demais monstros **não foram rebalanceados**. O exemplo anterior de Rat com 15 XP é ilustrativo e continua válido para explicar a mecânica, não a configuração atual.

## Premium

Nenhum multiplicador premium foi ativado nesta tarefa. Se for adicionado depois, a elegibilidade deve ser verificada no **servidor**, e o bônus será aplicado à recompensa, **não à fórmula** de nível. Manter uma configuração de bônus e uma função central evita duplicação.

## Penalidade de morte (provisória)

A morte perde **10% do progresso dentro do nível atual**, arredondado para baixo. Nesta fase não há perda de nível; `lifetimeExperience` permanece intacto. Isso impede que 10% de todo o XP cumulativo provoque quedas enormes de nível. A regra de delevel no estilo Tibia é uma decisão de design futura.

## Compatibilidade e migração de dados

O schema `Character` agora mantém:
- `xp`: experiência cumulativa atual, no formato novo;
- `lifetimeXp`: histórico recebido;
- `xpVersion`: `1` (save legado com XP por nível) ou `2` (save cumulativo).

Para registros anteriores, `DatabasePersistence` preserva o **nível** e converte a porcentagem do progresso dentro dele para a nova curva no primeiro carregamento. O XP histórico original **não é recuperável exatamente**, pois antes não era armazenado. O valor de `lifetimeXp` é inicializado como estimativa a partir do novo XP acumulado, e a conversão é registrada no log.

**Antes de iniciar o servidor com o banco existente, faça backup PostgreSQL.** `synchronize:true` do TypeORM pode alterar o schema durante o desenvolvimento. A versão de XP será salva como `2` na próxima persistência; não é uma operação reversível sem backup.

## Protocolo com Unity

`playerStats` agora envia:
- `xp` — XP total atual;
- `xpToNext` — XP total exigido pelo próximo nível;
- `levelXp` — XP ganho neste nível;
- `levelXpToNext` — custo incremental do nível;
- `lifetimeXp` — XP recebido na trajetória.

`StatusManager` usa `levelXp/levelXpToNext` para a barra e exibe os valores cumulativos em texto. O `PlayerStatsSender` **não altera atributos**.

## Testes e revisão

Executar em `server/`:

```bash
npm ci
npm run build
npm test
```

Depois verificar no Unity: reconexão, stats inicial, matar Rat, subir níveis, morte, skill level-up e combate. O arquivo `server/tests/experience.test.ts` contém regressões automatizadas para a nova regra.

> Até a execução dos testes e smoke test no Unity, esta implementação é **proposta em revisão**, não versão final aprovada.
