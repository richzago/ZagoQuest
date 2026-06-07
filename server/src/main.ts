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
 * - Iniciar a API REST (contas, personagens, autenticação)
 * - Aguardar a inicialização da API antes de iniciar o jogo
 * - Iniciar o servidor do jogo (mundo, entidades, loops, etc.)
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
import { startGame } from "./game/core/gameStarter";
import { ConditionRegistry } from "./data/items/conditions/conditionRegistry";
import { MonsterRegistry } from "./data/monsters/monsterRegistry";

/**
 * Função principal de inicialização do servidor.
 * Executa de forma assíncrona para garantir a ordem correta das operações.
 *
 * @remarks
 * A API deve ser inicializada primeiro porque o jogo pode precisar acessar
 * dados do banco (ex: guildas, personagens) durante a inicialização.
 * As definições de condições e monstros são carregadas antes do jogo começar.
 *
 * @returns {Promise<void>}
 */
async function bootstrap() {
  // 1. Mensagem inicial
  Logger.system("🔥 ZagoQuest iniciando...");

  // 2. Registra os listeners de eventos (logs, conquistas, etc.)
  registerEventListeners();

  // 3. Carrega as definições de condições (poison, burn, stun, haste)
  ConditionRegistry.load();

  // 4. Carrega todos os monstros recursivamente (suporta nomes curtos como "rat")
  MonsterRegistry.loadAll();

  // 5. Inicia a API REST e aguarda a conexão com o banco de dados
  await startApi();

  // 6. Nome do personagem (pode vir de variável de ambiente ou fixo para testes)
  const characterName = process.env.CHARACTER_NAME || "Richard";

  // 7. Inicia o servidor do jogo (mundo, entidades, loops)
  startGame(characterName);
}

/**
 * Executa a inicialização e captura erros fatais.
 */
bootstrap().catch((err) => {
  Logger.error(`Erro fatal: ${err}`);
});
