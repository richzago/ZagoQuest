/** Phase 7: safe public Guild image URL and DTO contracts. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { guildImageUrlSchema } from "../src/shared/schemas/guild.schema";
import { GuildController } from "../src/api/controllers/guildController";
import { GuildService } from "../src/api/services/guildService";

function outcome() {
  const result: { status: number; body?: unknown } = { status: 200 };
  const res = { status(status: number) { result.status = status; return this; },
    json(body: unknown) { result.body = body; return this; } } as unknown as Response;
  return { result, res };
}
function request() { return { params: { guildName: "Guardia" },
  user: { id: "account-a" }, body: { characterName: "Owner", imageUrl: "https://cdn.example.test/a.png" } } as unknown as Request; }

test("Guild URLs accept HTTPS, reject javascript, credentials, giant and unsafe HTTP", () => {
  assert.equal(guildImageUrlSchema.safeParse("https://cdn.example.test/img.webp").success, true);
  for (const url of [
    "javascript:alert(1)", "data:text/html,<script>alert(1)</script>",
    "ftp://cdn.example.test/asset.png", "http://cdn.example.test/asset.png",
    "https://name:secret@cdn.example.test/a", "https://cdn.example.test/" + "x".repeat(2100),
    "not a URL", "",
  ]) assert.equal(guildImageUrlSchema.safeParse(url).success, false, url.slice(0,100));
});

test("Guild public details use explicit DTO; never serialize internal fields", async () => {
  const previous = GuildService.getGuildByName;
  GuildService.getGuildByName = (async () => ({
    id: "uuid", name: "Guardia", description: "Friends", profileImage: "https://cdn.example.test/1",
    level: 5, logs: ["PRIVATE CHAT"], members: [{ characterId: "private-uuid" }],
    passwordHash: "should-never-be-public", internalDebug: true,
  })) as typeof previous;
  try {
    const { result, res } = outcome();
    await GuildController.getGuildDetails(request(), res);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      id: "uuid", name: "Guardia", description: "Friends", profileImage: "https://cdn.example.test/1", level: 5,
    });
  } finally { GuildService.getGuildByName = previous; }
});

test("Guild HTTPS image updates retain success contract; invalid URL is a 400 rule error", async () => {
  const original = {
    owner: GuildService.characterBelongsToAccount,
    memberGuild: GuildService.getPlayerGuild,
    setProfile: GuildService.setProfileImage,
    setCover: GuildService.setCoverImage,
  };
  GuildService.characterBelongsToAccount = async () => true;
  GuildService.getPlayerGuild = (async () => ({ name: "Guardia" })) as typeof original.memberGuild;
  GuildService.setProfileImage = async (_name, url) => {
    if (!guildImageUrlSchema.safeParse(url).success) throw new (await import("../src/api/services/guildService")).GuildRuleError("imageUrl inválida");
  };
  GuildService.setCoverImage = GuildService.setProfileImage;
  try {
    for (const handler of [GuildController.updateProfileImage, GuildController.updateCoverImage]) {
      const valid = outcome();
      await handler(request(), valid.res);
      assert.equal(valid.result.status, 200);
      const invalid = outcome();
      const forged = request(); forged.body.imageUrl = "javascript:alert(1)";
      await handler(forged, invalid.res);
      assert.equal(invalid.result.status, 400);
    }
  } finally {
    GuildService.characterBelongsToAccount = original.owner;
    GuildService.getPlayerGuild = original.memberGuild;
    GuildService.setProfileImage = original.setProfile;
    GuildService.setCoverImage = original.setCover;
  }
});
