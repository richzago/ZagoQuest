import { Logger } from "./game/core/logger/logger";
import { registerEventListeners } from "./game/core/events/eventListeners";
import { startApi } from "./api/server";
import { startGame } from "./game/core/gameStarter";

Logger.system("🔥 ZagoQuest iniciando...");
registerEventListeners();

// Inicia a API REST (contas e personagens)
startApi().catch((err: Error) => Logger.error(`Erro ao iniciar API: ${err.message}`));

// // Personagem fixo para testes locais (enquanto não há cliente)
// const characterName = "Richard";

// // Inicia o jogo
// startGame(characterName);
