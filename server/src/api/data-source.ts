/**
 * data-source.ts
 *
 * Configuração do TypeORM para conexão com o banco de dados PostgreSQL.
 * Define as entidades, credenciais e opções de sincronização.
 *
 * synchronize: true é usado apenas em desenvolvimento (cria/atualiza tabelas automaticamente).
 * Em produção, isso deve ser desabilitado e substituído por migrations.
 *
 * @module api/data-source
 */

/**
 * Fonte de dados principal do TypeORM.
 * Responsável pela conexão com o banco PostgreSQL e pelo gerenciamento das entidades.
 *
 * @remarks
 * - `synchronize: true` cria/atualiza tabelas automaticamente. Útil apenas em desenvolvimento.
 * - `logging: false` desativa a exibição de queries SQL no console. Altere para `true` para depuração.
 *
 * @example
 * ```typescript
 * await AppDataSource.initialize();
 * const accountRepo = AppDataSource.getRepository(Account);
 * const accounts = await accountRepo.find();
 * ```
 */
// src/api/data-source.ts
import "reflect-metadata";

import dotenv from "dotenv";

dotenv.config();

import { DataSource } from "typeorm";
import { Account } from "./entities/Account";
import { Character } from "./entities/Character";
import { Guild } from "./entities/Guild";
import { GuildMember } from "./entities/GuildMember";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "zagoquest",
  synchronize: true,
  logging: true,
  entities: [Account, Character, Guild, GuildMember],
});
