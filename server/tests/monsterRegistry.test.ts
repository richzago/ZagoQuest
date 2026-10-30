import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MonsterRegistry } from "../src/data/monsters/monsterRegistry";

const valid = {
  id: "test-rat",
  name: "Test Rat",
  stats: { hp: 20 },
  combat: { xp: 4, damageMin: 1, damageMax: 3 },
  ai: { type: "aggressive" },
  visual: { symbol: "R" },
  loot: [{ itemId: "currency/gold_coin", chance: 100000, min: 1, max: 4 }],
};

test("invalid or empty monster JSON is skipped; valid data still loads", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "zago-monster-def-"));
  t.after(() => {
    rmSync(dir, { recursive: true, force: true });
    MonsterRegistry.loadAll();
  });
  writeFileSync(join(dir, "rat.json"), JSON.stringify(valid));
  writeFileSync(join(dir, "skeleton.json"), "");
  writeFileSync(join(dir, "bandit.json"), JSON.stringify({ id: "bandit", name: "Bandit" }));
  writeFileSync(join(dir, "bad-stats.json"), JSON.stringify({ ...valid, id: "bad-stats", stats: { hp: -10 } }));
  writeFileSync(join(dir, "bad-loot.json"), JSON.stringify({ ...valid, id: "bad-loot", loot: [{ itemId: "x", chance: -1 }] }));
  writeFileSync(join(dir, "invalid-syntax.json"), "{");
  MonsterRegistry.loadAll(dir);
  assert.equal(MonsterRegistry.getAll().size, 1);
  assert.equal(MonsterRegistry.get("rat")?.name, "Test Rat");
  for (const bad of ["skeleton", "bandit", "bad-stats", "bad-loot", "invalid-syntax"]) {
    assert.equal(MonsterRegistry.get(bad), undefined, bad);
  }
});

test("reloading monster definitions clears data that is no longer on disk", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "zago-monster-reload-"));
  t.after(() => {
    rmSync(dir, { recursive: true, force: true });
    MonsterRegistry.loadAll();
  });
  const path = join(dir, "rat.json");
  writeFileSync(path, JSON.stringify(valid));
  MonsterRegistry.loadAll(dir);
  assert.ok(MonsterRegistry.get("rat"));
  writeFileSync(path, "");
  MonsterRegistry.loadAll(dir);
  assert.equal(MonsterRegistry.get("rat"), undefined);
  assert.equal(MonsterRegistry.getAll().size, 0);
});

test("real monster catalog loads Rat/Goblin and skips unimplemented placeholders", () => {
  MonsterRegistry.loadAll();
  assert.equal(MonsterRegistry.get("rat")?.name, "Rat");
  assert.equal(MonsterRegistry.get("goblin")?.name, "Goblin");
  assert.equal(MonsterRegistry.get("bandit"), undefined);
  assert.equal(MonsterRegistry.get("skeleton"), undefined);
});
