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

import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer, Server as HttpServer } from "http";
import { Logger } from "../game/core/logger/logger";
import accountRoutes from "./routes/account.routes";
import sessionRoutes from "./routes/session.routes";
import characterRoutes from "./routes/character.routes";
import { AppDataSource } from "./data-source";
import guildRoutes from "./routes/guild.routes";
import { isCorsOriginAllowed } from "./middlewares/corsPolicy";

// Carrega as variáveis de ambiente
dotenv.config();

// Cria a aplicação Express
const app = express();

// Middlewares globais
app.use(cors({ origin: (origin, callback) => callback(null, isCorsOriginAllowed(origin)) })); // Allowlist em produção
app.use(express.json({ limit: "16kb" })); // Limit POST bodies for small REST contracts.

const jsonInputErrors: ErrorRequestHandler = (error, _req, res, next) => {
  const type = (error as { type?: unknown }).type;
  if (type === "entity.too.large") {
    res.status(413).json({ error: "Corpo da requisição excede 16 KB." });
    return;
  }
  if (type === "entity.parse.failed") {
    res.status(400).json({ error: "JSON inválido." });
    return;
  }
  next(error);
};
app.use(jsonInputErrors);

// Rotas da API
app.use("/api/accounts", accountRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/characters", characterRoutes);
app.use("/api/guilds", guildRoutes);

// Do not let unhandled Express errors leak stack traces or infrastructure details.
const unexpectedRestError: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) { next(error); return; }
  Logger.warn("[API] Falha HTTP inesperada; detalhes internos omitidos da resposta.");
  res.status(500).json({ error: "Falha interna da API." });
};
app.use(unexpectedRestError);

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
