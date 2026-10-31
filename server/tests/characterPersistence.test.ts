/** Persistence identity regressions; database repository is replaced in-process. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { Player } from "../src/game/entities/player";
import { DatabasePersistence } from "../src/game/systems/databasePersistence";

type RepositoryStub = {
  findOne(criteria: { where: Record<string, string> }): Promise<Record<string, unknown> | null>;
  create(): Record<string, unknown>;
  save(entity: Record<string, unknown>): Promise<Record<string, unknown>>;
};

async function withRepository(stub: RepositoryStub, action: () => Promise<void>) {
  const persistence = DatabasePersistence as unknown as { characterRepo: unknown };
  const previous = persistence.characterRepo;
  persistence.characterRepo = stub;
  try { await action(); }
  finally { persistence.characterRepo = previous; }
}

test("saveCharacter searches by player UUID, never by the mutable name", async () => {
  const player = new Player("uuid-player", "DuplicatedName", 4, 5);
  player.gold = 89;
  const lookups: Record<string, string>[] = [];
  let saved: Record<string, unknown> | undefined;
  await withRepository({
    async findOne(criteria) {
      lookups.push(criteria.where);
      // A name-based lookup would select someone else's record.
      return criteria.where.name ? { id: "uuid-other", name: player.name } : null;
    },
    create: () => ({}),
    async save(entity) { saved = entity; return entity; },
  }, async () => DatabasePersistence.saveCharacter(player));

  assert.deepEqual(lookups, [{ id: player.id }]);
  assert.equal(saved?.id, "uuid-player");
  assert.equal(saved?.name, "DuplicatedName");
  assert.equal(saved?.gold, 89);
});

test("saving an existing UUID updates that entity without creating another", async () => {
  const player = new Player("uuid-existing", "Player", 6, 7);
  player.hp = 45;
  player.bankGold = 17;
  const existing: Record<string, unknown> = { id: player.id, name: "OriginalName" };
  let created = false;
  let saved: Record<string, unknown> | undefined;
  await withRepository({
    async findOne(criteria) {
      assert.deepEqual(criteria.where, { id: player.id });
      return existing;
    },
    create() { created = true; return {}; },
    async save(entity) { saved = entity; return entity; },
  }, async () => DatabasePersistence.saveCharacter(player));

  assert.equal(created, false);
  assert.equal(saved, existing);
  assert.equal(existing.hp, 45);
  assert.equal(existing.bankGold, 17);
  assert.equal(existing.posX, 6);
  assert.equal(existing.posY, 7);
  // Character rename must be handled by its own API, not implicit autosave.
  assert.equal(existing.name, "OriginalName");
});


test("C6: save legado 0/0 recupera mana da vocação, mas mana gasta 0/50 permanece zero",async()=>{
 for(const [savedMaxMana,expectedMana] of [[0,50],[50,0]]){
  await withRepository({
   async findOne(){return {
    id:"uuid-mana-"+savedMaxMana,name:"ManaTeste",level:1,xp:0,xpVersion:2,
    lifetimeXp:0,hp:100,maxHp:100,mana:0,maxMana:savedMaxMana,
    gold:0,bankGold:0,gender:"M",world:"main",vocation:"none",
    promotionStage:0,posX:2,posY:2,inventory:{},equipment:{},skills:{},
   };},
   create:()=>({}),
   async save(entity){return entity;},
  },async()=>{
   const p=await DatabasePersistence.loadCharacter("ManaTeste");
   assert.ok(p);
   assert.equal(p.maxMana,50);
   assert.equal(p.mana,expectedMana);
  });
 }
});
