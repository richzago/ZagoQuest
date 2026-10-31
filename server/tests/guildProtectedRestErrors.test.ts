/** Phase 7: protected Guild controllers map rule failures to 400 and SQL errors to safe 500. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { GuildController } from "../src/api/controllers/guildController";
import { GuildService, GuildRuleError } from "../src/api/services/guildService";

function response() {
  const result: { status: number; body?: unknown } = { status: 200 };
  const res = {
    status(code: number) { result.status = code; return this; },
    json(body: unknown) { result.body = body; return this; },
  } as unknown as Response;
  return { result, res };
}
const req = () => ({ user: { id: "account-a" }, params: { guildName: "Guardia" },
  body: { characterName: "Owned", guildName: "Guardia", description: "Valid description", imageUrl: "https://example.test/a.png" },
}) as unknown as Request;

test("Protected Guild REST errors: rules 400, SQL 500 without exposing database details", async () => {
  const original = {
    owner: GuildService.characterBelongsToAccount,
    playerGuild: GuildService.getPlayerGuild,
    create: GuildService.createGuild,
    description: GuildService.setDescription,
    profile: GuildService.setProfileImage,
    cover: GuildService.setCoverImage,
  };
  GuildService.characterBelongsToAccount = async () => true;
  GuildService.getPlayerGuild = async () => ({ name: "Guardia" } as Awaited<ReturnType<typeof original.playerGuild>>);
  try {
    for (const error of [new GuildRuleError("Apenas líder pode editar."), new Error("postgres://private:password@db")]) {
      GuildService.createGuild = (async () => { throw error; }) as typeof original.create;
      GuildService.setDescription = async () => { throw error; };
      GuildService.setProfileImage = async () => { throw error; };
      GuildService.setCoverImage = async () => { throw error; };
      for (const handler of [GuildController.create, GuildController.updateDescription,
        GuildController.updateProfileImage, GuildController.updateCoverImage]) {
        const { result, res } = response();
        await handler(req(), res);
        assert.equal(result.status, error instanceof GuildRuleError ? 400 : 500);
        assert.deepEqual(result.body, { error: error instanceof GuildRuleError
          ? "Apenas líder pode editar." : "Falha interna ao processar guilda." });
        assert.equal(JSON.stringify(result.body).includes("password@"), false);
      }
    }
  } finally {
    GuildService.characterBelongsToAccount = original.owner;
    GuildService.getPlayerGuild = original.playerGuild;
    GuildService.createGuild = original.create;
    GuildService.setDescription = original.description;
    GuildService.setProfileImage = original.profile;
    GuildService.setCoverImage = original.cover;
  }
});
