/** Regressões: economia in-memory durante transação REST de guilda. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { AppDataSource } from "../src/api/data-source";
import { Character } from "../src/api/entities/Character";
import { Guild } from "../src/api/entities/Guild";
import { GuildMember } from "../src/api/entities/GuildMember";
import { GuildService } from "../src/api/services/guildService";
import { Player } from "../src/game/entities/player";
import { OnlinePlayerDirectory } from "../src/game/systems/onlinePlayerDirectory";
import { withCharacterWriteLock } from "../src/game/systems/characterWriteLock";
import { MAX_GOLD } from "../src/game/systems/economyRules";
import { BankingSystem } from "../src/game/systems/bankingSystem";

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

async function fakePg(
  wallet: number,
  options: { fault?: "member"; pause?: ReturnType<typeof deferred> },
  action: (state: { gold: number; guilds: number; members: number }) => Promise<void>,
): Promise<void> {
  const source = AppDataSource as unknown as { transaction: unknown };
  const previous = source.transaction;
  const persisted = { gold: wallet, guilds: 0, members: 0 };
  source.transaction = async (work: (manager: { getRepository: (entity: unknown) => unknown }) => Promise<unknown>) => {
    const staging = { ...persisted };
    const ch = { id: "uuid-online", name: "Owner", gold: staging.gold, level: 101 };
    const manager = {
      getRepository(entity: unknown) {
        if (entity === Character) return {
          findOne: async (criteria: { lock?: { mode: string } }) => {
            assert.equal(criteria.lock?.mode, "pessimistic_write");
            return ch;
          },
          save: async (record: typeof ch) => {
            staging.gold = record.gold;
            if (options.pause) await options.pause.promise;
          },
        };
        if (entity === Guild) return {
          findOne: async () => null,
          create: (data: Record<string, unknown>) => data,
          save: async (data: Record<string, unknown>) => {
            staging.guilds++;
            return { ...data, id: "guild-1" };
          },
        };
        if (entity === GuildMember) return {
          findOne: async () => null,
          create: (data: Record<string, unknown>) => data,
          save: async () => {
            if (options.fault === "member") throw new Error("member failed");
            staging.members++;
          },
        };
        throw new Error("unexpected repository");
      },
    };
    const result = await work(manager);
    Object.assign(persisted, staging); // COMMIT somente em sucesso
    return result;
  };
  try { await action(persisted); }
  finally { source.transaction = previous; }
}

async function waitForReservation(player: Player, initialGold: number): Promise<void> {
  for (let i = 0; i < 30 && player.gold === initialGold; i++) {
    await Promise.resolve();
  }
  assert.notEqual(player.gold, initialGold, "operação não reservou gold");
}

test("guilda online usa gold vivo ainda não salvo e notifica após commit", async () => {
  const p = new Player("uuid-online", "Owner", 2, 2);
  p.level = 101; p.gold = 35_000;
  const notices: number[] = [];
  const cleanup = OnlinePlayerDirectory.bind(() => [p], (player) => notices.push(player.gold));
  try {
    await fakePg(20_000, {}, async (db) => {
      await GuildService.createGuild("Owner", "Guilda", "Teste");
      assert.equal(p.gold, 15_000);
      assert.equal(db.gold, 15_000);
      assert.equal(db.guilds, 1);
      assert.equal(db.members, 1);
      assert.deepEqual(notices, [15_000]);
    });
  } finally { cleanup(); }
});

test("falha no membro reverte taxa no PG e no Player, sem notificar", async () => {
  const p = new Player("uuid-online", "Owner", 2, 2);
  p.level = 101; p.gold = 25_000;
  let notices = 0;
  const cleanup = OnlinePlayerDirectory.bind(() => [p], () => notices++);
  try {
    await fakePg(25_000, { fault: "member" }, async (db) => {
      await assert.rejects(GuildService.createGuild("Owner", "Guilda", "Teste"), /member failed/);
      assert.equal(p.gold, 25_000);
      assert.equal(db.gold, 25_000);
      assert.equal(db.guilds, 0);
      assert.equal(notices, 0);
    });
  } finally { cleanup(); }
});

test("reserva bloqueia overflow de loot/saque durante transação e rollback devolve tudo", async () => {
  const p = new Player("uuid-online", "Owner", 2, 2);
  p.level = 101; p.gold = MAX_GOLD - 2_000;
  p.bankGold = 50_000;
  const pause = deferred(), cleanup = OnlinePlayerDirectory.bind(() => [p]);
  try {
    await fakePg(25_000, { fault: "member", pause }, async (db) => {
      const future = GuildService.createGuild("Owner", "Guilda", "Teste");
      await waitForReservation(p, MAX_GOLD - 2_000);
      assert.equal(p.gold, MAX_GOLD - 22_000);
      assert.equal(p.addGold(20_001), false);
      assert.equal(BankingSystem.withdrawGold(p, 20_001), false);
      assert.equal(p.addGold(2_000), true);
      pause.release();
      await assert.rejects(future, /member failed/);
      assert.equal(p.gold, MAX_GOLD);
      assert.equal(db.gold, 25_000);
    });
  } finally { cleanup(); }
});

test("autosave do mesmo UUID aguarda guilda e salva estado reembolsado após erro", async () => {
  const p = new Player("uuid-online", "Owner", 2, 2);
  p.level = 101; p.gold = 30_000;
  const pause = deferred(), cleanup = OnlinePlayerDirectory.bind(() => [p]);
  try {
    await fakePg(0, { fault: "member", pause }, async () => {
      const guild = GuildService.createGuild("Owner", "Guilda", "Teste");
      await waitForReservation(p, 30_000);
      assert.equal(p.gold, 10_000);
      const saves: number[] = [];
      const save = withCharacterWriteLock(p.id, async () => { saves.push(p.gold); });
      await Promise.resolve();
      assert.deepEqual(saves, []);
      pause.release();
      await assert.rejects(guild, /member failed/);
      await save;
      assert.deepEqual(saves, [30_000]);
    });
  } finally { cleanup(); }
});
