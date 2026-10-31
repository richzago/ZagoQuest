-- ZagoQuest Fase 8. COPIA SQL DA MIGRATION InitialSchema1793400000000.
-- SOMENTE postgres LOCAL e database NOVA/Vazia zagoquest_test (nunca zagoquest).
-- Alternativa manual ao npm run db:init:test; escolha UM dos dois caminhos.
-- Nao rodar este arquivo se ja executou db:init:test: possui guarda anti-reexecucao.
-- O comando TypeORM versionado segue sendo o metodo preferido.
-- Cria: accounts, characters, guilds, guild_members, migrations.
-- Nao faz DROP, TRUNCATE nem altera saves.
BEGIN;

DO $guard$
BEGIN
  IF current_database() <> 'zagoquest_test' THEN
    RAISE EXCEPTION 'Recusado: banco atual %; exige zagoquest_test.', current_database();
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
  ) THEN
    RAISE EXCEPTION 'Recusado: schema public nao esta vazio. Preserve os dados e confira sua configuracao.';
  END IF;
END
$guard$;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE "public"."characters_gender_enum" AS ENUM ('M', 'F');

CREATE TYPE "public"."guild_members_role_enum" AS ENUM ('leader', 'vice', 'officer', 'member');

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
      );

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
      );

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
      );

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
      );

-- Estrutura da tabela de historico das migrations criada pelo TypeORM.
CREATE TABLE "migrations" (
  "id" SERIAL PRIMARY KEY,
  "timestamp" bigint NOT NULL,
  "name" character varying NOT NULL
);

-- Registrar esta baseline SOMENTE porque o script acima criou TODAS as tabelas.
-- Nunca inserir essa linha isoladamente para esconder erro relation does not exist.
INSERT INTO "migrations" ("timestamp", "name")
VALUES (1793400000000, 'InitialSchema1793400000000');

COMMIT;

-- Consultas seguras para verificar o resultado (executar apos confirmar COMMIT):
SELECT current_database() AS database_atual, current_schema() AS schema_atual;
SELECT tablename
FROM pg_catalog.pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
SELECT "timestamp", "name" FROM public.migrations ORDER BY "timestamp";
