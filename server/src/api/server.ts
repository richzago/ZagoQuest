/**
 * server.ts
 *
 * Configura e inicializa o servidor HTTP da API REST.
 * Define middlewares globais (CORS, JSON), rotas e gerencia a conexão com o banco de dados.
 *
 * Agora retorna o servidor HTTP e o app Express, para permitir a integração com WebSocket.
 *
 * @module api/server
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer, Server as HttpServer } from "http";
import { Logger } from "../game/core/logger/logger";
import accountRoutes from "./routes/account.routes";
import sessionRoutes from "./routes/session.routes";
import characterRoutes from "./routes/character.routes";
import { AppDataSource } from "./data-source";
import guildRoutes from "./routes/guild.routes";

// Carrega as variáveis de ambiente
dotenv.config();

// Cria a aplicação Express
const app = express();

// Middlewares globais
app.use(cors()); // Permite requisições de diferentes origens
app.use(express.json()); // Habilita o parsing de JSON

// Rotas da API
app.use("/api/accounts", accountRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/characters", characterRoutes);
app.use("/api/guilds", guildRoutes);

/**
 * Inicializa a conexão com o banco de dados e retorna um servidor HTTP pronto.
 * O servidor ainda não está escutando; isso deve ser feito externamente para permitir
 * a adição do WebSocket antes de `listen`.
 *
 * @returns {Promise<HttpServer>} O servidor HTTP criado (ainda não iniciado).
 *
 * @example
 * ```typescript
 * // No main.ts
 * const httpServer = await startApi();
 * const world = new World();
 * const wsServer = new WebSocketServer(httpServer, world);
 * httpServer.listen(port);
 * ```
 */
export const startApi = async (): Promise<HttpServer> => {
  // The bootstrap owns the process and all resources. Never call
  // process.exit() inside this service: it would skip cleanup and final logs.
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    Logger.system("API conectada ao PostgreSQL com sucesso.");
    return createServer(app);
  } catch (error) {
    Logger.error(`Falha ao iniciar API: ${String(error)}`);
    throw error;
  }
};
