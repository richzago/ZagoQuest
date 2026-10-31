/** Central PostgreSQL connection. Configuration is safe by default. */
import "reflect-metadata";
import dotenv from "dotenv";
import { DataSource } from "typeorm";
import { Account } from "./entities/Account";
import { Character } from "./entities/Character";
import { Guild } from "./entities/Guild";
import { GuildMember } from "./entities/GuildMember";
import { resolveDatabaseRuntime } from "./databaseRuntime";
import { InitialSchema1793400000000 } from "./migrations/1793400000000-InitialSchema";

dotenv.config();

const runtime = resolveDatabaseRuntime();
export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: runtime.port,
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "zagoquest",
  synchronize: runtime.synchronize,
  logging: runtime.logging,
  entities: [Account, Character, Guild, GuildMember],
  migrations: [InitialSchema1793400000000],
  migrationsRun: false,
});
