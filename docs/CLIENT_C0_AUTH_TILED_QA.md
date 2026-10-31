# Cliente Unity — C0: WebSocket autenticado, assets e diagnóstico do Play Mode

**Caso:** 31/10/2026 — Play Mode carregava mapa, mas HUD e entidades permaneciam vazios, com desconexão `PolicyViolation` repetida. Registro do desenvolvedor. **O script não foi compilado no Unity pelo assistente**; CI Node valida contratos estáticos e backend.

## Diagnóstico: o que os logs provam

| Evidência | Conclusão | Classe |
| --- | --- | --- |
| Node: `API + WebSocket na porta 3000; aguardando login autenticado.` | PG, World e WS iniciaram; JWT/characterId exigidos | Backend OK nesse startup |
| Node: `MonsterLoader Goblin`, `NPC Loader Banker/Merchant` | Criados no World em memória; não implica snapshot enviado ao cliente | Fluxo World OK |
| Unity: `PolicyViolation` / 1008 após `Connected` | Handshake TCP ocorreu, mas sessão não foi autorizada | **Bug de integração P1** |
| `NetworkManager.cs` inicializava sem credenciais em modo legado; cena `scenebasic.unity` sem componente login | Modo Unity não batia com `WS_AUTH_REQUIRED=true` no Node; o servidor corretamente rejeitava sessão anônima | **Causa de código confirmada** |
| Unity: `Tileset vazio: Tilesets/[A]Wall-Up1_pipo` | PNG existe em `assets/tilesets/collision/walls`, mas não em `Client/Assets/Resources/Tilesets` | **Asset ausente P2** |
| Unity: `DontDestroyOnLoad only works for root GameObjects` | DragDropManager aninhado tentou persistir objeto não raiz | **Dívida lifecycle P2; não alterada neste PR** |

Os WARN de JSONs vazios `bandit`, `skeleton`, `fish_trout` e `platinum_coin` são conteúdo ainda não definido; não explicam a desconexão. `PlayerHUD` sem dados é esperado enquanto não chegam os snapshots de uma sessão autorizada; se **nome** continuar vazio após autenticar, abrir análise de contrato HUD específica.

## Correções deste PR

1. `Client/Assets/scenebasic.unity`: componente `SessionLoginDebugUI` ligado ao GameObject `NetworkManager`, com `apiUrl=http://localhost:3000` e `requireAuthenticatedSession: 1` serializado.
2. `Client/.../NetworkManager.cs`: default seguro `requireAuthenticatedSession=true`. Em `Start`, **não conecta** enquanto não há token e UUID; após selecionar personagem na UI, `Update` inicia o WebSocket. Registro de diagnóstico para 1008 sem imprimir JWT, dados pessoais ou credenciais; 1008 não gera loop automático.
3. `Client/Assets/Resources/Tilesets/[A]Wall-Up1_pipo.png`: imagem original já versionada no mapa fonte, copiada sem alteração binária para `Resources`, com novo `.meta` de cinco sprites de 32×32 para GIDs 31–35.
4. `TiledMapRenderer.cs`: erro de importação de sprites explica o caminho e a configuração esperada, sem emitir centenas de avisos.
5. `server/tests/unityAuthenticatedContracts.test.ts`: teste estático do valor default, cena e metadata do tileset. **Não equivale a Play Mode ou compilação C#**.

Nenhuma mudança em rotas REST, banco, dados salvos, mensagens WS, cálculo de combate ou autoridade do servidor.

## Roteiro local: começar pelo C0

1. Encerrar Play Mode e Node. Na raiz: `git status`, `git switch dev`, `git pull --ff-only origin dev`. Se houver alterações locais, preservar antes; não executar reset destrutivo.
2. Na pasta `server`, confirmar `.env` sem publicar: `NODE_ENV=development`, `DB_NAME=zagoquest_test`, `DB_SYNCHRONIZE=false`, `WS_AUTH_REQUIRED=true`, porta `3000`, JWT secret consistente com API/WS. Rodar `npm run build` e `npm start`.
3. Abrir **`Client/Assets/scenebasic.unity`** (não `SampleScene`) e selecionar GameObject `NetworkManager`. Verificar componentes `NetworkManager` + `SessionLoginDebugUI`; flag `Require Authenticated Session` ligada, URLs `ws://localhost:3000` e `http://localhost:3000`.
4. Conferir import do PNG `Client/Assets/Resources/Tilesets/[A]Wall-Up1_pipo.png`: `Texture Type: Sprite (2D and UI)`, `Sprite Mode: Multiple`, 5 sprites `[A]Wall-Up1_pipo_0..4`. Se Unity reimportar, aguardar concluir antes de Play.
5. Iniciar **Play Mode**: deve exibir painel QA `ZagoQuest - Sessão autenticada (QA)`. Sem login, não deve abrir WS (log `Aguardando login`), não deve ocorrer spam `PolicyViolation`.
6. Digitar email/senha de **teste** na UI, entrar, selecionar o personagem `Teste Alfa`. Esperado: `Sessão de personagem autenticada`, pacote `init`, `playerStats`, snapshots de goblin, banker, merchant, NPCs visíveis e HUD atualizado. Não enviar prints com senha/JWT.
7. Com `Teste Alfa` ainda conectado, abrir outra instância do jogo, logar `Teste Beta` e verificar isolamento. Conferir reconexão, spawn sem NPC duplicado, posição e gold após restart.
8. Se algum problema persistir, enviar logs limitados do Node `[SESSION]`/`[NETWORK]` e Console Unity, sem token/senha; capturar se painel QA apareceu, se evento `authenticated` ocorreu e se `SpawnHandler` recebeu entidades.
9. Depois de Play, conferir aviso `DontDestroyOnLoad` e se `PlayerHUD.playerNameText` continua sem nome. Esses são **candidatos para PR separado**, não pré-requisitos de autenticação.

### Critérios de aceite

- [ ] Compilação/import Unity sem erro e sem perda de referências Inspector.
- [ ] Com nenhum personagem selecionado, cliente NÃO abre conexão WebSocket.
- [ ] Com credenciais de conta A, recebe `authenticated` com UUID selecionado e `init/playerStats/spawn`.
- [ ] NPC/monstros reaparecem por snapshot autorizado; sem duplicação.
- [ ] Textura parede importa 5 sprites, sem `Tileset vazio`.
- [ ] Duas contas/UUID independentes e reconnect testados localmente.
- [ ] Resultado registrado no Notion [Auditoria Unity C0–C8](https://app.notion.com/p/40aec07d7c4f818eac62d7d6a2b2d933) com SHA dev e resultado do Play Mode.

**Não ativar autenticação legada como workaround**. Em produção, usar HTTPS/WSS com TLS, sem salvar tokens/senhas em Inspector/PlayerPrefs. Não executar scripts destrutivos de PostgreSQL local.
