/**
 * Transaction orchestration regressions. The fake unit of work commits only
 * when the callback resolves; a PostgreSQL integration test is still required.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { AppDataSource } from "../src/api/data-source";
import { Character } from "../src/api/entities/Character";
import { Guild } from "../src/api/entities/Guild";
import { GuildMember } from "../src/api/entities/GuildMember";
import { GuildService } from "../src/api/services/guildService";

type State = { gold: number; guilds: Array<Record<string, unknown>>; members: Array<Record<string, unknown>> };
type Fault = "member-save" | "guild-save" | undefined;

async function withTransaction(
  initialGold: number, fault: Fault, action: (state: State) => Promise<void>,
) {
  const source = AppDataSource as unknown as { transaction: unknown };
  const original = source.transaction;
  const state: State = { gold: initialGold, guilds: [], members: [] };
  const record: string[] = [];

  source.transaction = async (callback: (manager: { getRepository: (entity: unknown) => unknown }) => Promise<unknown>) => {
    const pending = { gold: state.gold, guilds: [...state.guilds], members: [...state.members] };
    const character = { id: "character-1", name: "Owner", level: 101, gold: pending.gold };
    const manager = {
      getRepository(entity: unknown) {
        if (entity === Character) return {
          findOne: async (query: { lock?: { mode: string } }) => {
            assert.equal(query.lock?.mode, "pessimistic_write");
            record.push("lock-character");
            return character;
          },
          save: async (value: typeof character) => { pending.gold = value.gold; record.push("debit"); },
        };
        if (entity === Guild) return {
          findOne: async () => null,
          create: (data: Record<string, unknown>) => data,
          save: async (data: Record<string, unknown>) => {
            if (fault === "guild-save") throw new Error("guild insert failed");
            data.id = "guild-1";
            pending.guilds.push(data);
            record.push("guild");
            return data;
          },
        };
        if (entity === GuildMember) return {
          findOne: async () => null,
          create: (data: Record<string, unknown>) => data,
          save: async (data: Record<string, unknown>) => {
            if (fault === "member-save") throw new Error("member insert failed");
            pending.members.push(data);
            record.push("leader");
            return data;
          },
        };
        throw new Error("unexpected repository");
      },
    };
    const outcome = await callback(manager);
    Object.assign(state, pending); // Commit only if all steps succeed.
    record.push("commit");
    return outcome;
  };

  try { await action(state); }
  finally { source.transaction = original; }
  return record;
}

test("creating a guild atomically debits gold and creates a leader + log", async () => {
  const steps = await withTransaction(25_000, undefined, async (state) => {
    const guild = await GuildService.createGuild("Owner", "Knights", "Amigos");
    assert.equal(guild.id, "guild-1");
    assert.equal(state.gold, 5_000);
    assert.equal(state.guilds.length, 1);
    assert.equal(state.members.length, 1);
    assert.equal(state.members[0].characterId, "character-1");
    assert.equal((state.guilds[0].logs as string[]).length, 1);
  });
  assert.deepEqual(steps, ["lock-character", "debit", "guild", "leader", "commit"]);
});

test("failed guild/member insert rolls back debit and every row", async () => {
  for (const fault of ["guild-save", "member-save"] as const) {
    await withTransaction(25_000, fault, async (state) => {
      await assert.rejects(
        GuildService.createGuild("Owner", "Knights", "Amigos"),
        /insert failed/,
      );
      assert.equal(state.gold, 25_000);
      assert.equal(state.guilds.length, 0);
      assert.equal(state.members.length, 0);
    });
  }
});

test("insufficient gold rejects purchase before any state mutation", async () => {
  const steps = await withTransaction(12_000, undefined, async (state) => {
    await assert.rejects(
      GuildService.createGuild("Owner", "Knights", "Amigos"),
      /20.000 gold/,
    );
    assert.equal(state.gold, 12_000);
    assert.equal(state.guilds.length, 0);
    assert.equal(state.members.length, 0);
  });
  assert.deepEqual(steps, ["lock-character"]);
});
