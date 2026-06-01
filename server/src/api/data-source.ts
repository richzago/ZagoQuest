import "reflect-metadata";
import { DataSource } from "typeorm";
import { Account } from "./entities/Account";
import { Character } from "./entities/Character";
import dotenv from "dotenv";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "zagoquest",
  synchronize: true, // desenvolvimento – cria/atualiza tabelas automaticamente
  logging: false, // altere para true se quiser ver as queries SQL no console
  entities: [Account, Character],
});
