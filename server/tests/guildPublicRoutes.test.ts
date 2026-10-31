/** Phase 7: public guild pagination and error sanitization without PostgreSQL. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { GuildController } from "../src/api/controllers/guildController";
import { GuildService } from "../src/api/services/guildService";
import { parseGuildPagination } from "../src/api/pagination";

function response() {
  const result: { status: number; body?: unknown } = { status: 200 };
  const res = {
    status(code: number) { result.status = code; return this; },
    json(body: unknown) { result.body = body; return this; },
  } as unknown as Response;
  return { result, res };
}
const request = (query: unknown = {}, guildName = "Knights") => ({ query, params: { guildName } }) as Request;

test("Guild pagination rejects negatives, injection-like values, unsafe and overly large limits", () => {
  assert.deepEqual(parseGuildPagination({}, 10), { page: 1, limit: 10 });
  assert.deepEqual(parseGuildPagination({}, 100), { page: 1, limit: 100 });
  assert.deepEqual(parseGuildPagination({ page: "5", limit: "42" }, 10), { page: 5, limit: 42 });
  for (const value of ["0", "-1", "1.5", "3junk", "10001", "999999999999", ["1", "2"], {}, null]) {
    assert.equal(parseGuildPagination({ page: value }, 10), null);
  }
  for (const value of ["0", "-2", "1.5", "11oops", "101", "100000", ["10", "20"], {}, null]) {
    assert.equal(parseGuildPagination({ limit: value }, 10), null);
  }
});

test("public guild rank/list handlers reject invalid pagination before database queries", async () => {
  const previous = {
    level: GuildService.getRankByLevel,
    kills: GuildService.getRankByKills,
    list: GuildService.listAllGuilds,
  };
  const calls: string[] = [];
  GuildService.getRankByLevel = (async (page, limit) => { calls.push(`level:${page}:${limit}`); return { data: [], total: 0 }; }) as typeof previous.level;
  GuildService.getRankByKills = (async (page, limit) => { calls.push(`kills:${page}:${limit}`); return { data: [], total: 0 }; }) as typeof previous.kills;
  GuildService.listAllGuilds = (async (page, limit) => { calls.push(`list:${page}:${limit}`); return { data: [], total: 0 }; }) as typeof previous.list;
  try {
    for (const [handler, label, defaultLimit] of [
      [GuildController.getRankByLevel, "level", 10],
      [GuildController.getRankByKills, "kills", 10],
      [GuildController.listAllGuilds, "list", 100],
    ] as const) {
      const invalid = response();
      await handler(request({ page: "-2", limit: "1000000" }), invalid.res);
      assert.equal(invalid.result.status, 400);
      assert.deepEqual(invalid.result.body, { error: "Paginação inválida." });
      const valid = response();
      await handler(request({ page: "2" }), valid.res);
      assert.equal(valid.result.status, 200);
      assert.deepEqual(valid.result.body, { page: 2, limit: defaultLimit, total: 0, data: [] });
      assert.equal(calls.at(-1), `${label}:2:${defaultLimit}`);
    }
    assert.equal(calls.length, 3, "Invalid inputs must never reach DB services");
  } finally {
    GuildService.getRankByLevel = previous.level;
    GuildService.getRankByKills = previous.kills;
    GuildService.listAllGuilds = previous.list;
  }
});

test("public guild endpoints return generic 500, not SQL exception details", async () => {
  const previous = { level: GuildService.getRankByLevel, details: GuildService.getGuildByName };
  GuildService.getRankByLevel = (async () => { throw new Error("postgres://secret:password@host"); }) as typeof previous.level;
  GuildService.getGuildByName = (async () => { throw new Error("postgres://secret:password@host"); }) as typeof previous.details;
  try {
    for (const handler of [GuildController.getRankByLevel, GuildController.getGuildDetails]) {
      const result = response();
      await handler(request(), result.res);
      assert.equal(result.result.status, 500);
      assert.deepEqual(result.result.body, { error: "Falha ao consultar guildas." });
    }
  } finally {
    GuildService.getRankByLevel = previous.level;
    GuildService.getGuildByName = previous.details;
  }
});

test("public guild details remove history logs and return 404 for missing names", async () => {
  const old = GuildService.getGuildByName;
  GuildService.getGuildByName = async (name) => name === "Knights"
    ? ({ name, description: "Hello", logs: ["PRIVATE INTERNAL LOG"] } as Awaited<ReturnType<typeof old>>)
    : null;
  try {
    const ok = response();
    await GuildController.getGuildDetails(request({}, "Knights"), ok.res);
    assert.equal(ok.result.status, 200);
    assert.deepEqual(ok.result.body, { name: "Knights", description: "Hello" });
    const missing = response();
    await GuildController.getGuildDetails(request({}, "Absent"), missing.res);
    assert.equal(missing.result.status, 404);
  } finally { GuildService.getGuildByName = old; }
});
