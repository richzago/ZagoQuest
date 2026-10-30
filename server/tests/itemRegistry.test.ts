import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ItemRegistry } from "../src/data/items/itemRegistry";

const item = (id: string) => ({
  id, name: id, description: "test item", type: "consumable", stackable: true,
});

test("multiple items in one JSON receive distinct aliases, never file basename", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "zago-registry-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "fishing"));
  writeFileSync(join(dir, "fishing", "fish.json"), JSON.stringify([
    item("fishing/fish/trout"), item("fishing/fish/salmon"),
  ]));
  ItemRegistry.loadAll(dir);
  assert.equal(ItemRegistry.get("fishing/fish/trout").id, "fishing/fish/trout");
  assert.equal(ItemRegistry.get("trout").id, "fishing/fish/trout");
  assert.equal(ItemRegistry.get("salmon").id, "fishing/fish/salmon");
  assert.throws(() => ItemRegistry.get("fish"), /não encontrado/);
});

test("ConditionDefinition is not an ItemType, and empty placeholders are skipped", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "zago-items-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "conditions"));
  mkdirSync(join(dir, "currency"));
  writeFileSync(join(dir, "conditions", "conditions.json"), JSON.stringify([
    { id: "poison", name: "Poison", defaultDuration: 1000, effects: [] },
  ]));
  writeFileSync(join(dir, "currency", "platinum_coin.json"), "");
  writeFileSync(join(dir, "currency", "gold_coin.json"), JSON.stringify({
    ...item("currency/gold_coin"), type: "currency",
  }));
  ItemRegistry.loadAll(dir);
  assert.equal(ItemRegistry.get("currency/gold_coin").id, "currency/gold_coin");
  assert.equal(ItemRegistry.get("gold_coin").id, "currency/gold_coin");
  assert.throws(() => ItemRegistry.get("poison"), /não encontrado/);
  assert.throws(() => ItemRegistry.get("platinum_coin"), /não encontrado/);
});

test("reloading item data clears entries removed from disk", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "zago-items-reload-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "first.json");
  writeFileSync(file, JSON.stringify(item("original")));
  ItemRegistry.loadAll(dir);
  assert.equal(ItemRegistry.get("original").id, "original");
  writeFileSync(file, JSON.stringify(item("replacement")));
  ItemRegistry.loadAll(dir);
  assert.throws(() => ItemRegistry.get("original"), /não encontrado/);
  assert.equal(ItemRegistry.get("replacement").id, "replacement");
});

test("real catalog excludes conditions and preserves fish aliases", () => {
  const base = join(process.cwd(), "src", "data", "items");
  ItemRegistry.loadAll(base);
  assert.equal(ItemRegistry.get("fishing/fish/trout").name, "Trout");
  assert.equal(ItemRegistry.get("salmon").name, "Salmon");
  assert.equal(ItemRegistry.get("fishing/baits/cricket").name, "Cricket");
  assert.equal(ItemRegistry.get("worm").name, "Worm");
  assert.throws(() => ItemRegistry.get("poison"), /não encontrado/);
});
