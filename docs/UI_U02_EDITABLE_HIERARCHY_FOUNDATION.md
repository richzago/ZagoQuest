# U02 — Hierarchy editável, etapa A

**Status:** ferramentas criadas em branch própria; Unity QA pendente; sem merge. U00 (PR #125) e U01 (PR #126) integradas à `dev`. U03 depende de U02.

## Entregue

- `Client/Assets/Resources/Scripts/UI/ZagoQuestUIComposition.cs`: referências visuais serializadas, sem lógica runtime.
- `Client/Assets/Editor/ZagoQuestUIRootBuilder.cs`: menu `ZagoQuest > UI > U02 - 1. Criar prefab de Hierarchy`. Gera `Assets/UI/Prefabs/Shell/ZQ_UIRoot_LayoutPreview.prefab` numa PreviewScene temporária; não sobrescreve Prefab existente.
- `Client/Assets/Editor/ZagoQuestUISceneInstaller.cs`: menu `ZagoQuest > UI > U02 - 2. Instalar estrutura INATIVA na scenebasic`. Usa Canvas `HUD` já existente; não duplica Prefab.
- Nenhum controller, ScriptableObject existente, cena ou backend alterado automaticamente.

## Hierarchy após U02-1 e U02-2

```text
HUD [Canvas real]
  ZQ_UIRoot_LayoutPreview [INACTIVE] [Prefab]
    LeftDockRoot
      LeftColumn1 / LeftColumn2 / LeftColumn3
    RightDockRoot
      RightColumn1 / RightColumn2 / RightColumn3
    CenterHudRoot
    BottomRoot
    ModalRoot
    TooltipRoot
```

**Não aparece nova interface no Game View**: nesta etapa só criamos a estrutura editável/desativada. Não há sistema de docking real, câmera adicional ou segundo Canvas.

## Checklist local detalhado

- [ ] U02-01: fechar Unity, fazer backup do fallback TMP e mover os 4 `.cs.meta` não rastreados para pasta de backup **fora** do repo, se ainda existirem; não apagá-los nem usar `git clean`.
- [ ] U02-02: atualizar `dev` local (após `git fetch`) e entrar na branch U02, sem usar `reset --hard` ou aplicar stashes.
- [ ] U02-03: abrir `Client` no Unity 6000.4.10f1 e `scenebasic`; Console sem erros C#.
- [ ] U02-04: menu `U02 - 1` cria `ZQ_UIRoot_LayoutPreview.prefab` em `Assets/UI/Prefabs/Shell`.
- [ ] U02-05: Prefab Mode contém root desativado, três colunas de cada lado e hosts centrais/inferiores, referências preenchidas em `ZagoQuestUIComposition`.
- [ ] U02-06: repetir `U02 - 1` não sobrescreve ou duplica.
- [ ] U02-07: menu `U02 - 2` coloca **uma instância inativa** dentro de `HUD`, sem novo Canvas.
- [ ] U02-08: repetir `U02 - 2` não duplica; salvar Ctrl+S, reabrir cena e confirmar persistência.
- [ ] U02-09: Play Mode: C18 preservada (login, Backpack+Stats, loot, NPC, minimapa, F6/F7/F8, clique no mundo).
- [ ] U02-10: confirmar 1280×720, 1920×1080 e F10. Esperado: HUD antiga igual; nova estrutura invisível, sem input bloqueado.
- [ ] U02-11: `git add` somente `Client/Assets/scenebasic.unity` + `Client/Assets/UI/Prefabs/Shell/ZQ_UIRoot_LayoutPreview.prefab` + respectivo `.meta`; revisar diff, commit, push; registrar evidência.

**Ainda faltará para encerrar U02:** migrar um painel piloto real para Prefab e comprovar edição por Inspector e vínculo aos controllers. Não iniciar U03 até concluir isso e homologar.

## Riscos/controle

Não ativar a raiz nova manualmente durante QA. Não alterar rede, movimentação, combate, economia, Bag UUID/slotId, minimapa C18 ou PlayerHUD funcional. Não declarar Unity compilado sem teste local.

- [Notion UI/UX](https://app.notion.com/p/40bec07d7c4f816e82e5d6d3a0d029f6)
- [Auditoria funcional C0–C18](https://app.notion.com/p/40aec07d7c4f818eac62d7d6a2b2d933)


## U02-B — piloto real: vitais do jogador em Prefab conectado

**Status:** código enviado, **não executado no Unity pela IA**. Não ativa automaticamente. Antes de usar, preservar a scene por commit/backup e conferir que U02-A instalou a estrutura inativa.

### Por que PlayerHUD / TopCenter?

- O `PlayerHUD` existente (componente do Canvas `HUD`) já mantém sliders reais `HPBar`, `ManaBar` e `XPBar` e textos do Node. Nenhum segundo componente de PlayerHUD deve ser criado.
- Antes, `PlayerHUD.Start()` executava `StyleGameplayHud()` e mudava toda a geometria e cores por C#. Na U02-B, o booleano **useInspectorVitalsLayout** é `false` por padrão; só muda para `true` quando o migrador conclui a conversão de `TopCenter` em Prefab.
- `ZagoQuestUiTheme` agora respeita as cores serializadas de títulos/sliders apenas desse conjunto, quando a opção Inspector está ativada. Não altera a aparência padrão dos demais painéis.
- Fonte autoritativa HP/MP/XP, métodos `UpdateStats`, eventos WS e overlays do Unity continuam intactos.

### Menu e artefato

**`ZagoQuest > UI > U02 - 3. Converter TopCenter REAL em Prefab`**:
verifica cena correta, Canvas HUD, referências, ausência de Prefab de destino, solicita confirmação; aplica uma única vez os valores visuais legados e **conecta o objeto existente** a `Assets/UI/Prefabs/Panels/ZQPlayerVitals.prefab`. Não clona sliders/controllers. Ativa o booleano `useInspectorVitalsLayout` no componente PlayerHUD da cena. Requer salvar a cena.

**`ZagoQuest > UI > U02 - 4. Verificar migracao de vitais`**:
diagnóstico somente leitura. Espera `Prefab conectado: True`, `Bindings HP/MP/XP: True`, `Usar Inspector: True`, `PlayerHUD(s): 1`.

### Checklist adicional U02-B (U02-A precisa estar validada)

- [ ] **B01** Unity Console sem erros. Em `scenebasic` selecionar `HUD` e confirmar `PlayerHUD` tem referências HP/MP/XP/labels preenchidas e apenas uma instância.
- [ ] **B02** Antes de converter, salvar `scenebasic` e criar screenshot do HUD antigo em 1280×720 e 1920×1080; evitar Play Mode durante conversão.
- [ ] **B03** Executar menu **U02 - 3**, confirmar diálogo. Esperado: `TopCenter` original continua no mesmo lugar e agora é **Prefab instance**, sem clones e sem Missing Script.
- [ ] **B04** Confirmar arquivo `Client/Assets/UI/Prefabs/Panels/ZQPlayerVitals.prefab` e `.meta` e pasta `Panels.meta` no Project. `HUD > PlayerHUD > Use Inspector Vitals Layout` marcado.
- [ ] **B05** Executar **U02 - 4**: os quatro indicadores devem ser **True/True/True/1**. Se falhar, parar e enviar Console, não commitar.
- [ ] **B06** Prefab Mode: alterar **um único detalhe cosmético reversível** (ex.: tamanho da fonte de `PlayerName` ou cor da `TopCenter`), salvar, Play Mode. Deve respeitar o Inspector em vez de ser reescrito pelo `PlayerHUD.Start`. Comparar com antes; depois escolher visual final.
- [ ] **B07** No jogo, receber atualizações reais HP/MP/XP, level, nome e posição. HP/MP/XP devem continuar reagindo a combate/consumo/ganho de XP e permanecer corretos após relogin.
- [ ] **B08** Regressão C18: Backpack + Stats, Loot, NPC, F6/F7/F8, minimapa e clique no mundo. Em 720p/1080p/F10, verificar que o prefab não bloqueia raycast ou movimentação.
- [ ] **B09** Salvar scene (Ctrl+S), sair Unity, inspecionar `git diff`. Fazer stage **somente** da scene, `ZQPlayerVitals.prefab`, `Panels.meta`, `ZQPlayerVitals.prefab.meta`, e eventualmente `ZQ_UIRoot_LayoutPreview.prefab` se ainda não enviado. NÃO incluir fallback TMP.
- [ ] **B10** Commit/push na branch U02; conferir PR #127. Enviar resultados B01–B09 para atualização do Notion e continuar U02 até homologação. Não iniciar U03 se houver erro visual ou duplicação.
- [ ] **B11** Em caso de problema, interromper no Editor e usar Undo antes de salvar. Não apagar arquivos nem executar reset hard. Como `TopCenter` real muda ao conectar o Prefab, o rollback deve partir de cena salva/commit de backup ou reversão da mudança focada em branch.

### Política de branches atualizada pelo usuário

**Não realizar novos merges na `dev` até finalizar U10.** U00 e U01 já foram integradas anteriormente e são a base congelada. U02 permanece PR Draft #127. A U03, quando autorizada, partirá de U02 validada, e seu PR terá U02 como branch base; seguir sucessivamente até U10 e só então propor integração final em `dev`. Nenhuma branch de UI deve alterar o histórico funcional de C0–C18.
