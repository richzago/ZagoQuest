# U03 — Docking responsivo e colunas editáveis (01/11/2026)

**Estado:** U03-A implementada em branch própria; Unity Editor/Play Mode AINDA NÃO TESTADOS nesta branch. PR Draft base `feature/ui-u02-editable-hierarchy-foundation`. **Proibido merge na `dev` antes de completar U10**, conforme decisão do desenvolvedor.

## Base e fronteiras

- Branch U03 sai exatamente do HEAD homologado da U02: `8df1e4fbc2fb58f4f8635fae70fbe126445c1c1e`. U02 [PR #127](https://github.com/richzago/ZagoQuest/pull/127) continua aberta, sem merge na dev.
- A C10 já possui colunas extras, colocação de Backpack e Loot, PlayerPrefs e cálculo de margem da câmera. Não reinventar sistemas de gameplay, World Camera ou o servidor Node.
- A U02 conectou `TopCenter` real a `ZQPlayerVitals.prefab`, com `PlayerHUD` único e valores de HP/MP/XP originais.
- O fallback `LiberationSans SDF - Fallback.asset` do TextMesh Pro está modificado localmente e deve permanecer **fora dos commits** enquanto a alteração não for justificada. Não mexer nos stashes.

## U03-A implementada — primeiro incremento seguro

1. `U03DockColumnConfig.cs`: configuração serializada no Canvas HUD existente (Prefab, opt-in). Não adiciona Canvas, câmera, controller de equipamento, inventário ou conexão.
2. `U03DockColumnEditor.cs`: três menus do Unity:
   - **U03 - 1. Criar prefab editavel de coluna**: cria `Assets/UI/Prefabs/Shell/ZQDockColumn.prefab` com `Image`, `Outline`, `Header`, `LaneTitle`, `ContentHost` (`RectMask2D`). Não sobrescreve Prefab existente.
   - **U03 - 2. Habilitar prefab de colunas na scenebasic**: exige cena correta, solicita confirmação; adiciona `U03DockColumnConfig` ao Canvas `HUD` e serializa a referência do Prefab com opt-in ativo. Execuções repetidas preservam configurações.
   - **U03 - 3. Verificar configuracao de colunas**: auditoria somente leitura; verifica Canvas HUD, uma configuração, referência válida e ContentHost.
3. `C10ClientLayoutSettings.CreateRail` reutiliza o Prefab visual **apenas** quando `U03DockColumnConfig.Current.UseAuthoredColumns` é verdadeiro. Se não houver configuração ou o Prefab for inválido, preserva o construtor C10 anterior. Mantém nomes `C10Left...`, hosts C8, lógica de PlayerPrefs, rolamento, redimensionamento e cálculo de viewport da câmera.
4. O Prefab define cores/bordas/cabeçalho e pode ser alterado em Prefab Mode sem editar o código do C10. Na U03-A, **a largura e posição das rails ainda são decididas pelo C10**, garantindo compatibilidade de câmera e limite para Game View estreita.

### Importante: o que NÃO foi implementado

- U03-A ainda NÃO substitui a sidebar principal C8 ou o painel de equipamentos por Prefabs.
- NÃO cria janelas independentes adicionais, arrastar colunas, ordenar painéis ou motor de docking genérico.
- NÃO remove o C10. A finalidade é começar a migrar seu **visual** para Prefab preservando o comportamento funcional existente.
- U03-B: avançar a disposição vertical de múltiplos painéis em colunas, minimizar/expandir, persistência de ordem e altura com limites seguros, depois de QA A.
- Sem novos skills/battle list fictícios, magias operacionais falsas ou dados inventados.

## Passo a passo (PowerShell na raiz do ZagoQuest)

Fechar Unity, executar `git status --short` e guardar qualquer alteração local não relacionada. Depois:

```powershell
git fetch origin
git switch --track -c feature/ui-u03-prefab-docking-columns origin/feature/ui-u03-prefab-docking-columns
git status --short
```

Se a branch U03 já existir, usar `git switch feature/ui-u03-prefab-docking-columns` seguido de `git pull --ff-only origin feature/ui-u03-prefab-docking-columns`. **Não executar `git pull origin dev` nem `git reset --hard`.**

### QA U03-A no Unity 6000.4.10f1

- [ ] **A01** Abrir `Client`, cena `Assets/scenebasic.unity`, Console sem erros vermelhos.
- [ ] **A02** Menu `ZagoQuest > UI > U03 - 1. Criar prefab editavel de coluna`. Verificar arquivo `Assets/UI/Prefabs/Shell/ZQDockColumn.prefab` e `.meta`.
- [ ] **A03** Abrir Prefab Mode. Confirmar objetos `Header`, `LaneTitle` e `ContentHost`; personalizar uma cor de fundo/borda no Inspector.
- [ ] **A04** Repetir menu U03-1. Prefab não duplicado e cor manual preservada.
- [ ] **A05** Abrir `scenebasic` fora do Play Mode; menu `U03 - 2. Habilitar prefab de colunas na scenebasic`. Confirmar componente `U03DockColumnConfig` no **Canvas HUD original**, com opção ligada e Prefab referenciado. Repetir não duplica.
- [ ] **A06** Menu `U03 - 3. Verificar configuracao de colunas` dá OK (uma config, Prefab presente, ContentHost presente).
- [ ] **A07** Play Mode. Na engrenagem Configurações, configurar colunas esquerda 1–3 e direita 1–3. Checar se **colunas extras** exibem a cor editada e nomes da posição, sem adicionar tela/canvas extra. A sidebar principal C8 mantém o layout atual.
- [ ] **A08** Configurar Backpack à esquerda e Loot na extra direita, abrir ambos (se suas configurações permitirem) e confirmar itens reais, drag/drop, scroll, altura regulável; sem clonar UI ou perder `slotId`, UUID e quantidades.
- [ ] **A09** Fechar e reabrir Backpack/Stats/Loot; NPC, Banker/Merchant, chat, fishing, F6/F7/F8 e clique no mundo continuam funcionais.
- [ ] **A10** Testar 1920×1080 e 1280×720 com F10 100/115/130%: C10 pode reduzir colunas automaticamente para preservar espaço. Câmera não estica, mapa não duplica e botões fora da rail funcionam.
- [ ] **A11** Desmarcar **Use Authored Columns** no Inspector (fora do Play Mode); Play Mode deve usar rails C10 legadas. Depois reativar opção e confirmar retorno dos Prefabs. Não mudar `dev` nem descartar stashes.
- [ ] **A12** Salvar cena Ctrl+S; fechar Unity. Stage **somente** `Client/Assets/scenebasic.unity`, `Client/Assets/UI/Prefabs/Shell/ZQDockColumn.prefab`, seu `.meta`. Verificar `git diff --cached --name-status` e `git diff --cached --check`, enviar commit/push **na U03**.
- [ ] **A13** Enviar relatório A01–A12 e evidência visual antes de U03-B.

## Gate para completar U03

- [ ] U03-A em Prefab Mode/Play Mode homologada no Unity e commitada.
- [ ] U03-B — mais de um painel vertical, resize de altura apenas, colapso sem sobreposição, salvar layout e compatibilidade de câmera — implementada e homologada.
- [ ] Regressões C18, 720p/1080p, dois logins e Console aprovadas.
- [ ] PR U03 baseado em U02, sem merge na dev. U04 só nascerá do HEAD aprovado da U03.

## Fontes e documentação

- [Notion de UI/UX — U00–U10](https://app.notion.com/p/40bec07d7c4f816e82e5d6d3a0d029f6)
- [Auditoria funcional do Unity](https://app.notion.com/p/40aec07d7c4f818eac62d7d6a2b2d933)
- [Plano técnico da U02](https://github.com/richzago/ZagoQuest/blob/feature/ui-u02-editable-hierarchy-foundation/docs/UI_U02_EDITABLE_HIERARCHY_FOUNDATION.md)
