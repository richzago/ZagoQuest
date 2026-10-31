/**
 * C8 UI polish: Node snapshot -> Unity Status de Fishing, sem gameplay novo.
 * O cliente nao calcula skill: lê o nivel autoritativo SkillType.FISHING.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { Player } from "../src/game/entities/player";
import { SkillType } from "../src/shared/enums/skillType.enum";
import { PlayerStatsSender } from "../src/network/senders/playerStatsSender";

const unity = (p: string) => readFileSync(join(process.cwd(), "..",
  "Client", "Assets", "Resources", "Scripts", p), "utf8");

test("C8: payload playerStats sempre envia o nivel real da skill Fishing", () => {
  const p = new Player("fish-p", "Fisher", 3, 8);
  const current = p.getSkillLevel(SkillType.FISHING);
  let payload = PlayerStatsSender.toPayload(p);
  assert.equal(payload.fishingLevel, current);
  assert.equal(payload.type, "playerStats");
  p.skills.set(SkillType.FISHING, {level: 42, progress: 0});
  payload = PlayerStatsSender.toPayload(p);
  assert.equal(payload.fishingLevel, 42);
  assert.equal(p.getSkillLevel(SkillType.FISHING), 42,
    "A UI nao deve alterar o nivel da skill.");
});

test("C8: Unity mostra Fishing no Status com snapshot recebido do Node", () => {
  const sender = readFileSync(join(process.cwd(), "src/network/senders/playerStatsSender.ts"),"utf8");
  const data = unity("Data/PlayerStatsData.cs");
  const handler = unity("Networking/Handlers/PlayerStatsHandler.cs");
  const stats = unity("Managers/StatusManager.cs");
  assert.match(sender, /fishingLevel: player\.getSkillLevel\(SkillType\.FISHING\)/);
  assert.match(data, /public int fishingLevel/);
  assert.match(handler, /json\.ToObject<PlayerStatsData>\(\)/);
  assert.match(handler, /OnPlayerStatsReceived\(stats\)/);
  assert.match(stats, /fishingLevelText\.text = stats\.fishingLevel > 0/);
  assert.match(stats, /stats\.fishingLevel:N0/);
  assert.match(stats, /C8FishingLevelText/);
  assert.doesNotMatch(stats, /AddSkillProgress|FishingSystem\.startFishing/);
});

test("C8: HUD de pesca permanece invisivel e a tecla R continua enviando apenas intencao", () => {
  const ui = unity("UI/C7FishingUI.cs");
  const sender = unity("Networking/Senders/FishingSender.cs");
  assert.match(ui, /private const bool ShowFishingPanel = false/);
  assert.match(ui, /bool show = connected && ShowFishingPanel/);
  assert.match(ui, /if \(root != null && root\.activeSelf != show\) root\.SetActive\(show\)/);
  assert.match(ui, /Keyboard\.current\.rKey\.wasPressedThisFrame/);
  assert.match(ui, /net\.Fishing\.StartFishing\(\)/);
  assert.match(ui, /net\.Fishing\.CancelFishing\(\)/);
  assert.match(ui, /ChatUI\.Instance\?\.AddMessage\("Pesca: " \+ message\)/);
  assert.match(sender, /type = "startFishing"/);
  assert.match(sender, /type = "cancelFishing"/);
  assert.doesNotMatch(ui, /IsPointerOverUi\(/);
});
