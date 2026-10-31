# Cliente Unity — C0: duas instâncias, build Windows e interface temática

**Data:** 31/10/2026 · **Escopo:** apresentação UI e qualidade do desenvolvimento, sem mudar lógica de rede, banco, autoridade do servidor ou gameplay.

## Como executar Alfa e Beta ao mesmo tempo

Não é necessário abrir dois Unity Hubs. O Hub gerencia o Editor; o multiplayer usa **uma instância do Editor + uma build independente** ou **duas builds**.

1. `git switch dev && git pull --ff-only origin dev`, preservando arquivos locais antes de atualizar; parar Node e Play Mode antes da atualização.
2. Abrir `Client/` no Unity Hub e a cena `Assets/scenebasic.unity`.
3. Em **File → Build Profiles** (Unity 6), selecionar **Windows**, conferir **Scene List** habilitada para `Assets/scenebasic.unity`. O Git já versiona esta escolha.
4. **Build** para uma pasta descartável `Builds/Windows/` fora de `Client/Assets`; arquivos binários não devem ser commitados.
5. Node: `cd server`, confirmar `DB_NAME=zagoquest_test`, `DB_SYNCHRONIZE=false`, `WS_AUTH_REQUIRED=true` no `.env`, `npm start`.
6. Abrir `ZagoQuest.exe` gerado e logar com `Teste Beta`; deixar rodando.
7. No Unity Editor, entrar em **Play** e logar `Teste Alfa`. Mover Alpha e observar Beta, depois o inverso; verificar nome/HP, spawn e isolamento de sessão. Usar duas contas distintas: **mesmo UUID em duas sessões é recusado intencionalmente**.
8. Para teste só com executáveis, abrir duas vezes o `.exe`, logar Alfa e Beta separadamente. Não abrir Unity Hub adicional.
9. Testar desconexão/reconexão e fechamento do Node com Ctrl+C. Confirmar que não há duplicação de mobs nem perda de progresso. Não divulgar JWT ou senhas.

## Melhorias C0 versionadas

- `MovementSender.cs`: removidos os dois logs `Movendo para...` e `Movendo direção...` executados a cada movimento. Mensagens e envio de payload são preservados; logs de erro/segurança continuam ativos.
- `EditorBuildSettings.asset`: a cena de build foi corrigida de `Assets/Scenes/SampleScene.unity` para `Assets/scenebasic.unity`. O que rodava no Editor não era necessariamente o mesmo do executável Windows.
- Novo `ZagoQuestUiTheme.cs`, anexado ao objeto `HUD` da cena: paleta inspirada em RPG/MMORPG 2D, com painéis azul-ardósia escuro, contorno bronze, tipografia marfim, dados de gold âmbar, botões com hover, HP rubi, mana azul e XP dourada.
- Tema aplicado em runtime aos painéis, inclusive os inicialmente inativos, com `GetComponentsInChildren(true)`. **Não reconstrói a Hierarchy**, não troca prefabs, não move ou redimensiona janelas, não altera mensagens/handlers/valores.
- Para desligar temporariamente o visual, no Inspector da GameObject `HUD`, desmarcar `ZagoQuest Ui Theme → Apply Theme At Runtime`. Visual do Inspector no Edit Mode pode continuar antigo porque a aplicação padrão ocorre em **Play Mode**.

### O que ainda pode ficar feio e está no backlog

O tema melhora identidade e contraste, **não é redesign completo**. A estrutura de layouts, responsividade, janelas arrastáveis, HUD compacto, ícones novos, design de inventário/loot e login de produção serão tratados em fases C6/C7 após o baseline visual. `SessionLoginDebugUI` é uma tela *temporária* de QA e continua simples nesta entrega.

## Critérios de aceite local

- [ ] Build Windows abre a mesma cena `scenebasic` do Editor, com login funcional.
- [ ] Editor + `.exe` conectam as contas Alfa/Beta simultaneamente ao Node local.
- [ ] Ao mover, desaparece o log constante `[MovementSender] Movendo direção`, mas movimento funciona.
- [ ] Painéis do HUD, inventory, equipment, chat, loot, bank e shop mantêm interações e ficam legíveis em 1920×1080 e numa resolução menor (ex.: 1366×768).
- [ ] HP/mana/XP preservam valores corretos e cores de leitura.
- [ ] Não surgem NullReference, cliques duplos ou sobreposição indevida por causa do tema.
- [ ] Conclusão e prints com dados ocultos compartilhados com [Notion Auditoria Unity C0–C8](https://app.notion.com/p/40aec07d7c4f818eac62d7d6a2b2d933).

**Segurança:** nenhuma execução de scripts destrutivos em banco local. `main` preservada. A CI Node é contrato estático; não compila/renderiza o projeto Unity.
