/**
 * server.ts
 *
 * Configura e inicializa o servidor HTTP da API REST.
 * Define middlewares globais (CORS, JSON), rotas e gerencia a conexão com o banco de dados.
 *
 * A função startApi() é chamada pelo main.ts para iniciar a API em paralelo ao servidor do jogo.
 *
 * @module api/server
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
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
app.use(cors()); // Permite requisições de diferentes origens (útil para o cliente Unity)
app.use(express.json()); // Habilita o parsing de JSON no corpo das requisições

// Rotas da API
app.use("/api/accounts", accountRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/characters", characterRoutes);
app.use("/api/guilds", guildRoutes);

/**
 * Inicia o servidor da API.
 * Conecta ao banco de dados via TypeORM e, em caso de sucesso, começa a escutar na porta configurada.
 * Em caso de erro, registra o erro e encerra o processo.
 *
 * @returns {Promise<void>} Não retorna valor, mas lança exceção em caso de falha crítica.
 *
 * @example
 * ```typescript
 * // No main.ts
 * startApi().catch(err => Logger.error(`Erro ao iniciar API: ${err}`));
 * ```
 */
export const startApi = async () => {
  try {
    // Estabelece a conexão com o PostgreSQL
    await AppDataSource.initialize();
    Logger.system("API conectada ao banco de dados (PostgreSQL) com sucesso!");

    // Obtém a porta da variável de ambiente ou usa 3000 como padrão
    const port = process.env.API_PORT || 3000;
    app.listen(port, () => {
      Logger.system(`API REST rodando na porta ${port}`);
    });
  } catch (err: any) {
    // Se a conexão falhar, loga o erro e encerra o processo (o jogo pode continuar? Mas a API é essencial)
    Logger.error(`Falha ao iniciar API: ${err.message}`);
    process.exit(1);
  }
};
