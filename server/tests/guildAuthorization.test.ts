/** HTTP guild authorization regression tests without PostgreSQL. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { GuildController } from "../src/api/controllers/guildController";
import { GuildService } from "../src/api/services/guildService";

function req(accountId: string | undefined, characterName = "Owned", guildName = "Knights") {
  return { user: accountId ? { id: accountId } : undefined,
    body: { characterName, guildName, description: "Guild description", imageUrl: "https://example.test/img" },
    params: { guildName } } as unknown as Request;
}
function response() {
  const out: { status: number; body?: unknown } = { status: 200 };
  const res = { status(code: number) { out.status = code; return this; },
    json(body: unknown) { out.body = body; return this; } } as unknown as Response;
  return { out, res };
}

test("protected guild routes enforce JWT-owned characters and the guild selected in URL", async () => {
  const original = {
    owner: GuildService.characterBelongsToAccount,
    guild: GuildService.getPlayerGuild,
    create: GuildService.createGuild,
    description: GuildService.setDescription,
    profile: GuildService.setProfileImage,
    cover: GuildService.setCoverImage,
  };
  const calls: string[] = [];
  GuildService.characterBelongsToAccount = async (name, account) => {
    calls.push(`owner:${name}:${account}`);
    return name === "Owned" && account === "account-a";
  };
  GuildService.getPlayerGuild = async () => ({ name: "Knights" } as Awaited<ReturnType<typeof original.guild>>);
  GuildService.createGuild = (async (...args: Parameters<typeof original.create>) => {
    calls.push("create");
    return { id: "guild-1", name: args[1], description: args[2] } as Awaited<ReturnType<typeof original.create>>;
  }) as typeof original.create;
  GuildService.setDescription = async () => { calls.push("description"); };
  GuildService.setProfileImage = async () => { calls.push("profile"); };
  GuildService.setCoverImage = async () => { calls.push("cover"); };

  try {
    const createOk = response();
    await GuildController.create(req("account-a"), createOk.res);
    assert.equal(createOk.out.status, 201);
    assert.equal(calls.includes("create"), true);

    for (const accountId of [undefined, "account-b"]) {
      const denied = response();
      await GuildController.create(req(accountId), denied.res);
      assert.equal(denied.out.status, accountId ? 403 : 401);
    }
    const foreignCharacter = response();
    await GuildController.create(req("account-a", "Other"), foreignCharacter.res);
    assert.equal(foreignCharacter.out.status, 403);
    assert.equal(calls.filter(c => c === "create").length, 1);

    for (const [handler, operation] of [
      [GuildController.updateDescription, "description"],
      [GuildController.updateProfileImage, "profile"],
      [GuildController.updateCoverImage, "cover"],
    ] as const) {
      const wrongGuild = response();
      await handler.call(GuildController, req("account-a", "Owned", "OtherGuild"), wrongGuild.res);
      assert.equal(wrongGuild.out.status, 403);
      assert.equal(calls.filter(c => c === operation).length, 0);

      const wrongCharacter = response();
      await handler.call(GuildController, req("account-a", "Other"), wrongCharacter.res);
      assert.equal(wrongCharacter.out.status, 403);
      assert.equal(calls.filter(c => c === operation).length, 0);

      const ownGuild = response();
      await handler.call(GuildController, req("account-a"), ownGuild.res);
      assert.equal(ownGuild.out.status, 200);
      assert.equal(calls.filter(c => c === operation).length, 1);
    }
  } finally {
    GuildService.characterBelongsToAccount = original.owner;
    GuildService.getPlayerGuild = original.guild;
    GuildService.createGuild = original.create;
    GuildService.setDescription = original.description;
    GuildService.setProfileImage = original.profile;
    GuildService.setCoverImage = original.cover;
  }
});
