/** C2: estático de contratos Unity — Play Mode/Windows build ainda obrigatórios. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(process.cwd(), "..", "Client", "Assets", "Resources", "Scripts");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

test("C2: prefab Goblin já traz MonsterIdentity e cliente não o destrói para recriar", () => {
  const prefab = readFileSync(join(process.cwd(), "..", "Client", "Assets", "Resources", "Prefabs", "goblin.prefab"), "utf8");
  const manager = read("Managers/EntityManager.cs");
  assert.match(prefab, /Assembly-CSharp::MonsterIdentity/);
  assert.match(manager, /EntityIdentity identity = go.GetComponent<EntityIdentity>\(\)/);
  assert.match(manager, /if \(identity == null\) identity = go.AddComponent<EntityIdentity>\(\)/);
  assert.match(manager, /MonsterIdentity monsterId = go.GetComponent<MonsterIdentity>\(\)/);
  assert.match(manager, /if \(monsterId == null\) monsterId = go.AddComponent<MonsterIdentity>\(\)/);
  assert.doesNotMatch(manager, /Destroy\(oldMonster\)|Destroy\(oldIdentity\)/,
    "Destroy no fim do frame e AddComponent no mesmo frame duplicam identidades");
  assert.match(manager, /monsterId\.entityId = id/);
  assert.match(manager, /identity\.entityId = id/);
  assert.match(manager, /if \(entities.ContainsKey\(id\)\) return/);
});

test("C2: singletons de entidades, nameplates e target não deixam instâncias obsoletas", () => {
  for (const file of [
    "Managers/EntityManager.cs", "UI/NameplateManager.cs", "Combat/TargetSelector.cs",
  ]) {
    const content = read(file);
    assert.match(content, /if \(Instance != null && Instance != this\)[\s\S]*?Destroy\(gameObject\);\s*return/);
    assert.match(content, /void OnDestroy\(\)[\s\S]*?if \(Instance == this\)/);
    assert.match(content, /Instance = null/);
  }
  const target = read("Combat/TargetSelector.cs");
  assert.match(target, /mouseClickAction\?\.Dispose\(\)/);
  assert.match(target, /attackAction\?\.Dispose\(\)/);
  assert.match(target, /toggleFollowAction\?\.Dispose\(\)/);
  assert.match(target, /NetworkManager\.Instance\.isConnected && NetworkManager\.Instance\.Combat != null/);
});

test("C2: fechamento da sessão remove seleção, avatares, itens e nameplates antes do próximo snapshot", () => {
  const network = read("Networking/NetworkManager.cs");
  const entity = read("Managers/EntityManager.cs");
  const names = read("UI/NameplateManager.cs");
  const selector = read("Combat/TargetSelector.cs");
  const onClose = network.split("socket.OnClose += (reason) =>")[1]?.split("socket.OnMessage += bytes =>")[0] ?? "";
  assert.match(onClose, /isConnected = false/);
  assert.match(onClose, /EntityManager.Instance\?\.ClearNetworkEntities\(\)/);
  assert.match(entity, /public void ClearNetworkEntities\(\)\s*\{\s*[\s\S]*?TargetSelector.Instance\?\.ClearTarget\(\);\s*if \(entities.Count == 0\) return;/);
  assert.match(entity, /NameplateManager.Instance\?\.RemoveNameplate\(pair.Key\)/);
  assert.match(entity, /ItemNameManager.Instance\?\.HideItemName\(pair.Key\)/);
  assert.match(entity, /if \(pair.Value != null\) Destroy\(pair.Value\)/);
  assert.match(entity, /entities\.Clear\(\)/);
  assert.match(names, /public void RemoveNameplate\(string entityId\)/);
  assert.match(selector, /ClearTargetInternal\(true\)/);
  const spawn = read("Networking/Handlers/SpawnHandler.cs");
  const despawn = read("Networking/Handlers/DespawnHandler.cs");
  assert.match(spawn, /manager\.SpawnRemotePlayer/);
  assert.match(spawn, /manager\.SpawnEntity/);
  assert.match(spawn, /manager\.SpawnItemOnGround/);
  assert.match(despawn, /context.EntityManager\?\.DespawnEntity\(despawnMsg.id\)/);
  assert.match(entity, /entities\.Remove\(id\)/);
});
