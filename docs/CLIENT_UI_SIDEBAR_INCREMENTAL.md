# ZagoQuest — UI incremental em quatro etapas

**Base aprovada:** PR #114 (cliques/loot) integrado na `dev`, commit `911cc8e8133c61f0e5555a5802b8d221eb5c5966`. Confirmação de Play Mode pelo usuário. **Nunca reverter o hotfix de `TargetSelector`**.

## Regras obrigatórias

1. Cada etapa em **branch separada, PR em Draft**, sem merge até o usuário testar no Unity Editor/Game View e der autorização explícita. **Não iniciar a etapa seguinte sem aprovação da anterior.**
2. Proibidas mudanças em pesca, loot, combate, movimento, rede, banco, economia e demais sistemas do Node. Mudanças apenas de interface.
3. `IsPointerOverUi` da C7 é código crítico: **NÃO alterar** sem reprovação objetiva + Play Mode. Imagens com alpha zero no Canvas ScreenSpace não podem bloquear ataque e loot. Não criar Image full-screen com `raycastTarget=true`. Apenas UI visível ou controles devem capturar os cliques.
4. Nenhuma etapa deve copiar cena, manipular Tiled, modificar scripts de movimento, alterar validações do servidor ou forçar um novo tamanho de câmera antes da etapa 4.
5. A CI Node **não** compila C# nem renderiza Unity; testes estáticos jamais substituem QA visual em duas resoluções e clique real.

## Etapa 1/4 — Sidebar independente

Branch: `feature/client-ui-sidebar-step1`. **Status: proposta para homologação, sem merge**.

**Entrega focalizada:** `C8SidebarShell.cs` cria `C8SidebarCanvas` e `SidebarSurface` à direita, com largura estável de referência 286, margens, título e três áreas decorativas reservadas. Mantém TODOS os painéis antigos flutuantes, sem docking, redimensionamento ou mudança de câmera. O Canvas é criado no início pela `NetworkManager` e acompanha a sessão autorizada. Respeita a escala visual F10 da C7. A sidebar fica atrás dos painéis legados (sorting -5) e abaixo do Canvas de pesca (420) e login (500).

**Cláusula de mouse:** o Canvas fullscreen não tem Image/Graphic. **Único** `raycastTarget=true` é a `SidebarSurface`, opaca, no limite lateral real. Textos, áreas decorativas e acento usam `raycastTarget=false`. Assim, `IsPointerOverUi` do PR #114 bloqueia intencionalmente cliques **dentro** da faixa visível, nunca fora dela. `TargetSelector.cs` não é modificado. Não ampliar caixas transparentes da HUD.

**Limite esperado:** como não mudou a câmera, o mundo continuará sendo renderizado atrás da sidebar; em posições perto da borda direita, o avatar pode ficar atrás dela. Isso só será tratado **na etapa 4**, após as validações. Painéis flutuantes legados ainda podem ficar visualmente sobre a sidebar, pois o encaixe será exclusivamente etapa 2.

### Homologação Unity necessária

- [ ] Editor compila C# sem erros e abre `Client/Assets/scenebasic.unity`; servidor sobe normalmente.
- [ ] Sidebar aparece somente após login, UMA vez; não duplica ao reconectar; desaparece ao fazer logout.
- [ ] 1920×1080: barra lateral direita estável, sem cobrir HUD central ou chat. Painéis antigos continuam funcionais e movíveis.
- [ ] 1280×720: a sidebar continua dentro da janela, textos legíveis, sem criar sobreposição imprevisível fora da coluna.
- [ ] Usar F10 100/115/130% e zoom +/−; UI escala como antes, câmera continua com mesmo comportamento (nenhum resize de viewport ou `camera.rect`).
- [ ] Clique fora da sidebar: monstro 1º clique inicia, **2º no mesmo monstro para**; Espaço continua alternando.
- [ ] Clique em corpse fora da sidebar abre loot em 1 tentativa; pickups e NPC merchant/banker continuam funcionais.
- [ ] Clique dentro da superfície visível da sidebar NÃO ataca nem abre corpo atrás (bloqueio legítimo de UI).
- [ ] Nenhuma área transparente fora da sidebar bloqueia ataques ou loot. Console C7 de diagnóstico sem erros.
- [ ] Build Windows e Play Mode testados na máquina do usuário.
- [ ] Usuário deu **sinal verde explícito** para merge desta etapa.

**Automação disponível:** `server/tests/clientC8SidebarContracts.test.ts` confirma contratos estáticos e salvaguardas. CI **não** homologará visuais.

## Etapa 2/4 — Encaixe dos painéis (NÃO INICIADA)

Após homologação da etapa 1, branch nova. Migrar gradualmente painéis existentes para a sidebar sem duplicar `InventoryUI`/`EquipmentUI`/`LootUI`/`StatusManager`; preservar referências e comandos existentes. Não alterar altura ajustável nem câmera. Testar visualmente cada encaixe e cliques reais, sem tocar em gameplay.

## Etapa 3/4 — Redimensionamento vertical (NÃO INICIADA)

Branch nova após etapa 2 aprovada. Permitir alterar **somente a altura**, nunca a largura da sidebar/painéis. Ajustar seções vizinhas sem sobreposição, com alças claras e limites mínimo/máximo. Verificar scroll e itens de loot. Não alterar câmera.

## Etapa 4/4 — Ajustes de câmera e viewport (NÃO INICIADA)

Branch nova após etapa 3 aprovada. Ajustar área útil/seguimento do player sem duplicar mundo, cortes errados ou esconder avatar em bordas, com 1280×720/1920×1080, zoom, Tiled e Game View. **Não reproduzir as alterações de câmera do PR #111/#112 sem testes controlados no Unity.**

### Fluxo de aceite

Implementar uma etapa → CI estática/Node → PR Draft → usuário baixa branch e verifica Game View/Windows → corrigir qualquer regressão **na mesma branch** → usuário dá sinal verde → merge para `dev` → somente então iniciar próxima etapa.

