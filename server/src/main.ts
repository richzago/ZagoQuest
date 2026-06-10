/**
 * main.ts
 *
 * Ponto de entrada principal do servidor ZagoQuest.
 *
 * Responsabilidades:
 * - Importar o reflect-metadata (necessário para o TypeORM)
 * - Inicializar o sistema de logs e eventos
 * - Carregar o registro de condições (efeitos como poison, burn, etc.)
 * - Carregar todos os monstros recursivamente (suporta nomes curtos no Tiled)
 * - Iniciar a API REST (conecta ao banco, mas não inicia o servidor HTTP imediatamente)
 * - Criar o mundo e o jogador (persistência via banco de dados)
 * - Iniciar o servidor WebSocket (compartilhando a mesma porta da API)
 * - Iniciar o servidor HTTP (API + WebSocket)
 * - Iniciar os loops do jogo (IA, autosave, guildas)
 *
 * O nome do personagem é definido por variável de ambiente (CHARACTER_NAME)
 * ou usa "Richard" como padrão durante os testes.
 * Futuramente, será obtido da sessão autenticada via WebSocket.
 *
 * @module main
 */

// Obrigatório para que o TypeORM funcione com decorators
import "reflect-metadata";

import { Logger } from "./game/core/logger/logger";
import { registerEventListeners } from "./game/core/events/eventListeners";
import { startApi } from "./api/server";
import { ConditionRegistry } from "./data/items/conditions/conditionRegistry";
import { MonsterRegistry } from "./data/monsters/monsterRegistry";
import { createWorldAndPlayer } from "./game/initialization/worldFactory";
import { startGameLoops } from "./game/core/gameStarter";
import { WebSocketServer } from "./network/websocket/wsServer";

/**
 * Função principal de inicialização do servidor.
 * Executa de forma assíncrona para garantir a ordem correta das operações.
 *
 * @remarks
 * **Fluxo de execução:**
 * 1. Carrega condições e monstros.
 * 2. Conecta ao banco de dados e prepara o servidor HTTP (ainda não escutando).
 * 3. Cria o mundo e o jogador (persistência – carrega ou cria no banco).
 * 4. Instancia o WebSocket Server (compartilhando o mesmo servidor HTTP).
 * 5. Inicia o servidor HTTP (porta 3000) – agora API e WebSocket estão ativos.
 * 6. Inicia os loops de IA, autosave e guildas.
 *
 * @returns {Promise<void>}
 */
async function bootstrap() {
  try {
    // =========================
    // 1. Inicializações básicas
    // =========================
    Logger.system("🔥 ZagoQuest iniciando...");
    registerEventListeners();
    ConditionRegistry.load();
    MonsterRegistry.loadAll();

    // =========================
    // 2. Prepara o servidor HTTP (conecta ao banco, mas não escuta ainda)
    // =========================
    Logger.system("Inicializando API e conectando ao banco de dados...");
    const httpServer = await startApi();
    Logger.system("API pronta, servidor HTTP aguardando WebSocket.");

    // =========================
    // 3. Cria o mundo e o jogador (uma única vez, com persistência)
    // =========================
    const characterName = process.env.CHARACTER_NAME || "Richard";
    Logger.system(`Criando/carregando mundo e jogador: ${characterName}`);
    const { world, player } = await createWorldAndPlayer(characterName);
    Logger.system("Mundo e jogador inicializados com sucesso.");

    // =========================
    // 4. Inicializa o servidor WebSocket (usando o mesmo servidor HTTP e o mundo)
    // =========================
    Logger.system("Configurando WebSocket...");
    let wsServer: WebSocketServer;
    try {
      wsServer = new WebSocketServer(httpServer, world);
      Logger.system("WebSocket Server iniciado com sucesso.");
    } catch (wsErr: any) {
      Logger.error(`Falha ao criar WebSocket Server: ${wsErr.message}`);
      process.exit(1);
    }

    // =========================
    // 5. Inicia o servidor HTTP (escuta na porta configurada)
    // =========================
    const port = process.env.API_PORT || 3000;
    try {
      httpServer.listen(port, () => {
        Logger.system(`API e WebSocket rodando na porta ${port}`);
      });
    } catch (listenErr: any) {
      Logger.error(`Erro ao iniciar servidor HTTP na porta ${port}: ${listenErr.message}`);
      process.exit(1);
    }

    // =========================
    // 6. Inicia os loops do jogo (IA, autosave, guildas) sobre o mundo já criado
    // =========================
    startGameLoops(world, player, wsServer);
    Logger.system(`Jogo iniciado com o personagem: ${characterName}`);
  } catch (error: any) {
    // Captura qualquer erro não tratado durante o bootstrap
    Logger.error(`Erro fatal durante a inicialização do servidor: ${error.message}`);
    Logger.error(error.stack);
    process.exit(1);
  }
}

/**
 * Executa a inicialização e captura erros fatais (redundante, pois o bootstrap já tem catch, mas por segurança).
 */
bootstrap().catch((err) => {
  Logger.error(`Erro fatal não capturado: ${err.message}`);
  process.exit(1);
});
