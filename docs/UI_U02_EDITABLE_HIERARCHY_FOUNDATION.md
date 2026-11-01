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
