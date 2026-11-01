# ZagoQuest UI — U00: baseline e auditoria de cena (01/11/2026)

**Status:** ferramenta U00 e cena local versionadas na branch; menu da auditoria visto pelo usuário no Editor. **Unity Play Mode completo: NÃO DOCUMENTADO**. **Sem merge autorizado**.

## Escopo aprovado

- Congelar a referência técnica inicial da C18: `dev` em `bb3eec50a247b5cf57cd95bfffe9a7fca6e75e41`, [PR #124](https://github.com/richzago/ZagoQuest/pull/124) homologada 8/8 e mergeada.
- Inspecionar e integrar em segurança a cena real `Client/Assets/scenebasic.unity` e seu `.meta`, **sem substituí-la pela versão do GitHub**.
- Não alterar protocolos, gameplay, gerenciadores, C18/Node, prefabs existentes ou rotinas de inicialização da HUD.
- Prover comando de auditoria somente leitura no Unity (menu **ZagoQuest > UI > U00 - Auditar cena aberta**) para identificar raiz HUD, número de Canvas, câmeras MainCamera, EventSystems, componentes sem script e elementos raycast.
- Preservar os 4 arquivos `.cs.meta` locais pendentes referentes às classes C16 e C18; versioná-los junto com a cena no mesmo PR U00, **após inspeção do usuário no Windows**.
- **Não versionar automaticamente** `LiberationSans SDF - Fallback.asset`: mudança de asset automática depende de inspeção e decisão; backup obrigatório antes de qualquer restore. `git stash` existente não deve ser aplicado/limpo.

## Dependências verificadas

- Projeto: Unity `6000.4.10f1`.
- Cena no repositório: `Client/Assets/scenebasic.unity` + `scenebasic.unity.meta`.
- Scripts existentes que geram/rearranjam UI em runtime: `C8SidebarShell`, `C8SidebarDynamicDock`, `C10ClientLayoutSettings`, `C6InventoryEquipmentLayout`, `PlayerHUD` e `StatusManager`.
- O `C18TiledMinimap` já segue o tile confirmado pelo servidor. `C18HudHotkeys` usa F6/F7/F8 e F10 é gerenciado por acessibilidade.
- Auditoria funcional mantém os contratos de Bags, `slotId`, UUID, NPC, pesca e multiplayer.

## Checklist U00

- [x] Identificar cena `scenebasic` e versão do Unity no GitHub.
- [x] Confirmar C18 integrada na base `dev` e registrar SHA.
- [x] Criar a branch `feature/ui-u00-baseline-scene-audit`.
- [x] Preparar script de auditoria **não intrusivo** da cena.
- [ ] Usuário fazer backup da cena e inspecionar `git status`, `git diff`, `git stash list` (sem aplicar).
- [ ] Usuário fazer checkout da branch U00 preservando as alterações locais.
- [x] Usuário enviou `scenebasic.unity` e os 4 `.cs.meta` pendentes (constatado no PR #125). Revisão visual do conteúdo e QA completo seguem necessários.
- [x] Cena local e quatro `.cs.meta` aparecem no PR #125 (HEAD verificado `73928fc`); `LiberationSans SDF - Fallback.asset` não integra o PR, permanece modificado no working tree local.
- [ ] Unity Editor: abrir `scenebasic`, executar a ferramenta U00, copiar logs e tirar screenshots 1280×720/1920×1080/F10.
- [ ] Checar ausência de Missing Script, falta de GUID, erro de Console, Canvas duplicado ou câmera extra.
- [ ] Conferir se a cena abre, os managers continuam com referências, equipamentos, NPC, loot, Stats+Backpack, hotkeys e minimapa preservados.
- [ ] Pedir homologação e aprovação explícita antes do merge U00 na `dev`.

## Cuidados locais (Windows, PowerShell)

1. Fechar o Unity antes de operações de branch/merge em YAML de cena; salvar e fazer cópia externa antes de qualquer checkout.
2. `client` e `Client` divergem em letras maiúsculas no `git status`. Usar caminhos canônicos `Client/Assets/...` do Git; verificar `git ls-files`.
3. Evitar `git clean -fd`, `git reset --hard`, `git restore .`, `git stash pop` ou `git add .`.
4. Nunca atualizar `dev` diretamente com cena local sem a revisão da branch U00.
5. Usar auditoria **funcional** para regressão C18; usar [página de UI/UX no Notion](https://app.notion.com/p/40bec07d7c4f816e82e5d6d3a0d029f6) para visual.

## Aceite

Cena local rastreada com `.meta` originais, script de diagnóstico sem efeito colateral, baseline de screenshots e logs reproduzíveis. Sem alteração de comportamento ou persistência. CI Node não compila Unity.

## Checkpoint 01/11/2026 — após envio local

- [x] PR #125 contém a cena atualizada e os quatro `.cs.meta` locais; commit HEAD remoto `73928fce3d761e9eed98ceebff7920691859194c`.
- [x] Desenvolvedor confirmou encontrar a ferramenta U00 no menu do Unity e relatou que estava tudo certo no Editor; isso **não é homologação detalhada do Play Mode C18**.
- [ ] Conferir relatório da auditoria, screenshot e regressão integrada antes de recomendar merge.
- [ ] Inspecionar mudança local do fallback TMP; não versionar sem motivo técnico, backup externo se houver risco.
- [ ] Rodar U01 isolada (scripts de tema/gerador) em branch própria, sem assumir que ela contém a cena atualizada de U00.

Documento vivo [Notion UI/UX](https://app.notion.com/p/40bec07d7c4f816e82e5d6d3a0d029f6).
