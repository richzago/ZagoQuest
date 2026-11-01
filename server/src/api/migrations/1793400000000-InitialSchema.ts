/**
 * Baseline of the four TypeORM entities for a FRESH PostgreSQL database.
 *
 * This is NOT an upgrade path for a populated legacy zagoquest database.
 * Executed only through the guarded db:init:test command against an empty,
 * explicitly named disposable database. Never automatically at server startup.
 */
import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1793400000000 implements MigrationInterface {
  public readonly name = "InitialSchema1793400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // TypeORM PostgreSQL @PrimaryGeneratedColumn("uuid") uses uuid_generate_v4.
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(`CREATE TYPE "public"."characters_gender_enum" AS ENUM ('M', 'F')`);
    await queryRunner.query(`CREATE TYPE "public"."guild_members_role_enum" AS ENUM ('leader', 'vice', 'officer', 'member')`);

    await queryRunner.query(`
      CREATE TABLE "accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying(255) NOT NULL,
        "cellphone" character varying(20) NOT NULL,
        "fullName" character varying(255) NOT NULL,
        "cpf" character varying(11) NOT NULL,
        "birthDate" date NOT NULL,
        "passwordHash" character varying(255) NOT NULL,
        "address" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_accounts_email" UNIQUE ("email"),
        CONSTRAINT "UQ_accounts_cpf" UNIQUE ("cpf")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "characters" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(50) NOT NULL,
        "gender" "public"."characters_gender_enum" NOT NULL,
        "world" character varying NOT NULL DEFAULT 'main',
        "level" integer NOT NULL DEFAULT 1,
        "xp" integer NOT NULL DEFAULT 0,
        "lifetimeXp" double precision NOT NULL DEFAULT 0,
        "xpVersion" integer NOT NULL DEFAULT 1,
        "hp" integer NOT NULL DEFAULT 100,
        "maxHp" integer NOT NULL DEFAULT 100,
        "mana" integer NOT NULL DEFAULT 0,
        "maxMana" integer NOT NULL DEFAULT 0,
        "inventory" jsonb NOT NULL DEFAULT '{}',
        "containerState" jsonb NOT NULL DEFAULT '{}',
        "equipment" jsonb NOT NULL DEFAULT '{}',
        "skills" jsonb NOT NULL DEFAULT '{}',
        "gold" integer NOT NULL DEFAULT 0,
        "bankGold" integer NOT NULL DEFAULT 0,
        "posX" double precision NOT NULL DEFAULT 0,
        "posY" double precision NOT NULL DEFAULT 0,
        "accountId" uuid,
        "vocation" character varying NOT NULL DEFAULT 'none',
        "promotionStage" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_characters" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_characters_name" UNIQUE ("name"),
        CONSTRAINT "FK_characters_account" FOREIGN KEY ("accountId")
          REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "guilds" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(50) NOT NULL,
        "description" character varying(500) NOT NULL DEFAULT '',
        "profileImage" text NOT NULL DEFAULT '',
        "coverImage" text NOT NULL DEFAULT '',
        "level" integer NOT NULL DEFAULT 1,
        "exp" integer NOT NULL DEFAULT 0,
        "totalKills" integer NOT NULL DEFAULT 0,
        "castleConquests" integer,
        "logs" jsonb NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guilds" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_guilds_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "guild_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "guildId" uuid NOT NULL,
        "characterId" uuid NOT NULL,
        "characterName" character varying(50) NOT NULL,
        "level" integer NOT NULL,
        "isPremium" boolean NOT NULL DEFAULT false,
        "role" "public"."guild_members_role_enum" NOT NULL DEFAULT 'member',
        "joinedAt" TIMESTAMP NOT NULL,
        "lastSeen" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guild_members" PRIMARY KEY ("id"),
        CONSTRAINT "FK_guild_members_guild" FOREIGN KEY ("guildId")
          REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_guild_members_character" FOREIGN KEY ("characterId")
          REFERENCES "characters"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);
  }

  public async down(): Promise<void> {
    // Do not expose a helper that drops an entire player's data model.
    throw new Error(
      "Baseline de banco não pode ser revertida automaticamente. Use apenas um backup restaurável de uma base descartável.",
    );
  }
}
