/**
 * Integração real de PostgreSQL em base DESCARTÁVEL do GitHub Actions.
 * NUNCA executar contra a base local zagoquest. Opt-in obrigatório.
 */
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { AppDataSource } from "../src/api/data-source";
import { Character } from "../src/api/entities/Character";
import { Guild } from "../src/api/entities/Guild";
import { GuildMember } from "../src/api/entities/GuildMember";
import { GuildService } from "../src/api/services/guildService";
import { DatabasePersistence } from "../src/game/systems/databasePersistence";
import { OnlinePlayerDirectory } from "../src/game/systems/onlinePlayerDirectory";
import { Player } from "../src/game/entities/player";

if (process.env.RUN_PG_TESTS !== "true" ||
    process.env.DB_NAME !== "zagoquest_ci" ||
    process.env.NODE_ENV !== "development") {
  throw new Error("Teste de PostgreSQL só pode rodar com RUN_PG_TESTS=true, DB_NAME=zagoquest_ci e NODE_ENV=development.");
}

let counter = 0;
async function fixture(gold: number) {
  const name = `CiPlayer${++counter}`;
  const repo = AppDataSource.getRepository(Character);
  const row = await repo.save(repo.create({
    name, gender: "M", level: 101, xp: 0, gold, bankGold: 500,
    inventory: {}, equipment: {}, skills: {},
  }));
  return row;
}

before(async () => {
  assert.equal(AppDataSource.options.synchronize, true, "Schema sync só é aceito nesta base descartável de CI.");
  await AppDataSource.initialize();
});
after(async () => {
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
});

test("PostgreSQL real: gold online prevalece sobre saldo SQL antigo e autosave não reverte cobrança", async () => {
  const row = await fixture(1_000);
  const p = new Player(row.id, row.name, 2, 2);
  p.level = 101; p.gold = 32_000; p.bankGold = 500;
  const cleanup = OnlinePlayerDirectory.bind(() => [p]);
  try {
    await GuildService.createGuild(row.name, "Primeira", "Integração real");
    assert.equal(p.gold, 12_000);
    const charged = await AppDataSource.getRepository(Character).findOneByOrFail({ id: row.id });
    assert.equal(charged.gold, 12_000);
    await DatabasePersistence.saveCharacter(p);
    const saved = await AppDataSource.getRepository(Character).findOneByOrFail({ id: row.id });
    assert.equal(saved.gold, 12_000);
    assert.equal(saved.bankGold, 500);
    assert.equal(await AppDataSource.getRepository(GuildMember).count({ where: { characterId: row.id } }), 1);
  } finally { cleanup(); }
});

test("PostgreSQL real: personagem offline perde taxa exatamente uma vez", async () => {
  const row = await fixture(40_000);
  await GuildService.createGuild(row.name, "Segunda", "Integração real offline");
  const saved = await AppDataSource.getRepository(Character).findOneByOrFail({ id: row.id });
  assert.equal(saved.gold, 20_000);
  assert.equal(await AppDataSource.getRepository(GuildMember).count({ where: { characterId: row.id } }), 1);
});

test("PostgreSQL real: falha de INSERT no membro provoca ROLLBACK de gold e guilda", async () => {
  const row = await fixture(25_000);
  const p = new Player(row.id, row.name, 2, 2);
  p.level = 101; p.gold = 25_000;
  await AppDataSource.query(`
    CREATE FUNCTION ci_abort_member_insert() RETURNS trigger AS $ci$
      BEGIN RAISE EXCEPTION 'ci injected member failure'; RETURN NEW; END;
    $ci$ LANGUAGE plpgsql
  `);
  await AppDataSource.query(`
    CREATE TRIGGER ci_block_member BEFORE INSERT ON guild_members
    FOR EACH ROW EXECUTE FUNCTION ci_abort_member_insert()
  `);
  const cleanup = OnlinePlayerDirectory.bind(() => [p]);
  try {
    await assert.rejects(
      GuildService.createGuild(row.name, "Terceira", "Rollback real"),
      /ci injected member failure/,
    );
    const saved = await AppDataSource.getRepository(Character).findOneByOrFail({ id: row.id });
    assert.equal(saved.gold, 25_000);
    assert.equal(p.gold, 25_000);
    assert.equal(await AppDataSource.getRepository(Guild).count({ where: { name: "Terceira" } }), 0);
    assert.equal(await AppDataSource.getRepository(GuildMember).count({ where: { characterId: row.id } }), 0);
  } finally {
    cleanup();
    await AppDataSource.query("DROP TRIGGER IF EXISTS ci_block_member ON guild_members");
    await AppDataSource.query("DROP FUNCTION IF EXISTS ci_abort_member_insert()");
  }
});

test("PostgreSQL real: chamadas concorrentes não cobram duas vezes", async () => {
  const row = await fixture(55_000);
  const p = new Player(row.id, row.name, 2, 2);
  p.level = 101; p.gold = 55_000;
  const cleanup = OnlinePlayerDirectory.bind(() => [p]);
  try {
    const result = await Promise.allSettled([
      GuildService.createGuild(row.name, "Quarta", "Uma criação"),
      GuildService.createGuild(row.name, "Quinta", "Outra criação"),
    ]);
    assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(result.filter((r) => r.status === "rejected").length, 1);
    assert.equal(p.gold, 35_000);
    const saved = await AppDataSource.getRepository(Character).findOneByOrFail({ id: row.id });
    assert.equal(saved.gold, 35_000);
    assert.equal(await AppDataSource.getRepository(GuildMember).count({ where: { characterId: row.id } }), 1);
  } finally { cleanup(); }
});
