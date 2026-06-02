/**
 * main.ts
 * 
 * Ponto de entrada principal do servidor ZagoQuest.
 * Responsabilidades:
 * - Inicializar o sistema de logs e eventos
 * - Iniciar a API REST (contas, personagens, autenticação)
 * - Iniciar o jogo propriamente dito (mundo, jogador, NPCs, loops, tarefas agendadas)
 * 
 * O nome do personagem é fixo ("Richard") enquanto não há integração com a API.
 * Futuramente, será obtido da sessão autenticada via WebSocket.
 */

import { Logger } from "./game/core/logger/logger";
import { registerEventListeners } from "./game/core/events/eventListeners";
import { startApi } from "./api/server";
import { startGame } from "./game/core/gameStarter";

// ------------------------------------------------------------
// 1. Inicializa o sistema de logs e eventos globais
// ------------------------------------------------------------
Logger.system("🔥 ZagoQuest iniciando...");
registerEventListeners();

// ------------------------------------------------------------
// 2. Inicia o servidor HTTP da API (contas, personagens, autenticação)
// ------------------------------------------------------------
startApi().catch((err) => Logger.error(`Erro ao iniciar API: ${err}`));

// ------------------------------------------------------------
// 3. Define o nome do personagem (temporariamente fixo para testes)
// ------------------------------------------------------------
// Quando o cliente Unity estiver pronto, esse nome virá da sessão autenticada.
const characterName = "Richard";

// ------------------------------------------------------------
// 4. Inicia o servidor do jogo (mundo, entidades, loops, etc.)
// ------------------------------------------------------------
startGame(characterName);