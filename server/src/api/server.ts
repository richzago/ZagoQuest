import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Logger } from "../game/core/logger/logger";
import accountRoutes from "./routes/account.routes";
import sessionRoutes from "./routes/session.routes";
import characterRoutes from "./routes/character.routes";
import { AppDataSource } from "./data-source";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/accounts", accountRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/characters", characterRoutes);

export const startApi = async () => {
  try {
    await AppDataSource.initialize();
    Logger.system("API conectada ao banco de dados (PostgreSQL) com sucesso!");
    const port = process.env.API_PORT || 3000;
    app.listen(port, () => {
      Logger.system(`API REST rodando na porta ${port}`);
    });
  } catch (err: any) {
    Logger.error(`Falha ao iniciar API: ${err.message}`);
    process.exit(1);
  }
};
