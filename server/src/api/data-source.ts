import "reflect-metadata";
import { DataSource } from "typeorm";
import { Account } from "./entities/Account";
import { Character } from "./entities/Character";
import dotenv from "dotenv";
dotenv.config();

const isSQLite = process.env.DB_TYPE === "sqlite";

export const AppDataSource = new DataSource(
  isSQLite
    ? {
        type: "better-sqlite3", 
        database: process.env.DB_PATH || "./data/zagoquest.sqlite",
        synchronize: true,
        logging: false,
        entities: [Account, Character],
      }
    : {
        type: "postgres",
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || "5432"),
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        synchronize: true,
        logging: false,
        entities: [Account, Character],
      },
);
