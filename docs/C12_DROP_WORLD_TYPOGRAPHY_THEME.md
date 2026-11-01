# C12 — Drop no mundo, fonte e visual Obsidian/Bronze (01/11/2026)

**Branch:** `feature/server-authoritative-containers-loot-c9` · **PR:** #119 (DRAFT) → `dev`. Sem merge sem autorização.

## Diagnóstico
- **P0, bloqueio de teste:** `InventorySlot.OnEndDrag` e `EquipmentSlotUI.OnEndDrag` usavam `GetComponentInParent<Canvas>()` para recusar o chão. A cena tem HUDs com Graphics transparentes que também são hits; só estar dentro do Canvas não significa uma janela bloqueadora. Agora o raycast considera controles interativos, transparência e CanvasGroup, e checa o retângulo efetivo da câmera.
- **P2, warning TMP:** U+23FB no label SAIR não está no LiberationSans SDF. Warning de ausência do glifo **não comprova crash nem desconexão**; substituído por 'SAIR' e 'OFF'.
- **P1, visual:** C11 já aplicava cores em runtime. C12 torna o cabeçalho visivelmente em placa, adiciona bronze mais nítido e minimapa quadrado em grade (placeholder, não funcional). Não modifica gameplay nem copia assets externos.

## Segurança e arquitetura
- `DropOnGround` preserva posição confirmada pelo Node, tile por floor, distância Manhattan ≤2, `fromEquipment` e UUID da Bag, sem tirar item antes do ACK.
- O Node continua revalidando bounds, posse, quantidade, alcance e sessão. `EventSystem.RaycastAll` distingue UI realmente clicável de imagens transparentes.
- Nova suíte `clientC12DragDropAndThemeContracts.test.ts` cobre contratos estáticos das alterações em C#. Ela **não compila nem executa Unity**.

## Checklist de homologação Unity
1. Abrir Play Mode conectado: procurar 'CLIENTE C12' no cabeçalho, minimapa quadrado e botão Sair 'OFF' quando dockado, sem warning U+23FB.
2. Arrastar Simple Bag equipada do slot BACKPACK para tile do mundo visível a 1–2 tiles Manhattan. Deve haver um único `dropItem`, ACK e a Bag no chão, sem sumir outra instância.
3. Recolher a Bag, equipar outra igual, testar UUID próprio e conteúdos isolados. Arrastar de dentro da Bag para chão.
4. Soltar item sobre um botão, Backpack, janela, loot, chat, fora do viewport ou longe do personagem: nenhum drop deve ser autorizado.
5. Comparar Game Views 1280×720 e 1920×1080 e F10 100%, 115%, 130% para verificar layout/recorte sem interposição invisível.
6. Testar NPC sobre item, combate, loot→Bag, loot→chão, Shift+L, navegação de Bags e logout/reconexão.
7. Se falhar, registrar **o retorno dropError**, tipo/origem do item e posição confirmada. Mensagem de solicitação enviada não é confirmação de drop.

## Estado de QA
- Código alterado e suíte estática incluída no comando npm test; aguarda resultado efetivo do CI.
- Compilação Unity C#, Play Mode, renderização e integração cliente-servidor **pendentes da homologação local**.
- Itens no chão ainda não persistem entre reinicializações do Node. Recolher Bags com conteúdo antes de reiniciar.

**Não realizar merge de #119 em dev/main até autorização expressa.**
