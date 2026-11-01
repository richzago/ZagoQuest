# ZagoQuest UI — U01: Design System Obsidian & Bronze (01/11/2026)

**Status:** primeira implementação de fundação visual isolada; **Editor/Play Mode NÃO TESTADOS**. PR Draft em branch específica, sem merge.

## Contrato de escopo

- Aprovação visual: **primeira imagem** da proposta avançada inspirada em Tibia/Cyleria.
- O visual deve ser **original**; não importar sprites/molduras proprietários da referência.
- Esta etapa **não altera `scenebasic.unity`, `C8SidebarShell`, gerenciadores, Canvas ativos, câmera ou protocolo.**
- U00 (scene baseline) é pré-requisito para integrar Prefabs na Hierarchy em U02.
- Scripts criados aqui são **opt-in**, nenhum é adicionado automaticamente ao jogo.

## Implementação entregue na branch U01

- `ZagoQuestUIThemeAsset.cs`: ScriptableObject com cores semânticas, compactação/densidade, referência opcional a fonte TextMesh Pro e dimensões editáveis.
- `ZagoQuestUIThemeSetup.cs`: menu **ZagoQuest > UI > U01 - Criar tema e prefabs de exemplo (seguro)**, gera em `Assets/UI` o tema e quatro prefabs básicos: `ZQPanelFrame`, `ZQIconButton`, `ZQProgressBar`, `ZQEquipmentSlotVisual`.
- Asset creator **não sobrescreve** Prefabs/tema existentes e não modifica a cena.
- Os ícones de configuração são modelos sem listeners nem sprite; a progress bar mostra um valor ilustrativo **somente no template**, não no runtime. A integração com dados reais fica para U04/U05.

## Checklist de QA U01

- [x] Criar branch independente `feature/ui-u01-design-system` a partir da C18 `dev`.
- [x] Definir tokens do tema Obsidian & Bronze e medidas iniciais compactas.
- [x] Criar gerador de componentes visuais do Editor que não modifica cena.
- [ ] Abrir a branch U01 no Unity `6000.4.10f1` **somente depois de salvar/push de U00**.
- [ ] Confirmar compilação C# no Editor, sem Missing Script/Assembly errors.
- [ ] Executar menu U01 e conferir arquivos `Assets/UI/Themes` e `Assets/UI/Prefabs`.
- [ ] Inspecionar e personalizar o tema no Inspector; abrir cada Prefab em Prefab Mode.
- [ ] Rodar menu duas vezes e confirmar **não sobrescrita** de customizações.
- [ ] Inspecionar arredondamento, bordas, texto, icon placeholder e barra de progresso.
- [ ] Verificar `scenebasic` permanece sem modificação pelo menu, Play Mode legado ainda íntegro.
- [ ] Fazer commit dos `.asset`, `.prefab`, `.meta` gerados, **se aprovados**; revisar diffs antes.
- [ ] Incluir screenshot/feedback e registrar homologação no [Notion UI/UX](https://app.notion.com/p/40bec07d7c4f816e82e5d6d3a0d029f6).
- [ ] Solicitar autorização expressa antes de merge.

## Limitações declaradas

1. O resultado ainda **não é a HUD nova**, e sim seus blocos construtivos iniciais.
2. Não há compilação Unity em CI neste PR; testes automatizados Node anteriores **não** validam o C#.
3. Prefabs não estão vinculados ao `EquipmentUI`, `PlayerHUD`, `StatusManager`, `C18TiledMinimap` ou ao Node.
4. É necessária aprovação visual e possível substituição por sprites 9-slice / fontes licenciadas antes da migração U02.
5. As propriedades do ScriptableObject definem os valores ao **gerar** templates; alterações posteriores no tema ainda não propagam automaticamente aos Prefabs. Binding vivo de tema é decisão de implementação futura, não reivindicar como implementado.

## Critérios de aceite

Pelo menos 4 Prefabs seguros gerados no Unity, tema editável, sem alterações de jogo, sem mutações na cena ou regressão do estado C18.
