/** Node owns movement cadence; Unity may only schedule requests at that rate. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Player } from "../src/game/entities/player";
import { PlayerStatsSender } from "../src/network/senders/playerStatsSender";
import { getPlayerMoveIntervalMs } from "../src/game/systems/movementSystem";
const unity=(path:string)=>readFileSync(join(process.cwd(),"..","Client","Assets","Resources","Scripts",path),"utf8");

test("playerStats includes authoritative movement interval for level-ups", () => {
  const player=new Player("speed-sync","Speed",2,2);
  assert.equal(PlayerStatsSender.toPayload(player).moveIntervalMs,150);
  player.level=51;
  assert.equal(PlayerStatsSender.toPayload(player).moveIntervalMs,getPlayerMoveIntervalMs(player));
  assert.equal(PlayerStatsSender.toPayload(player).moveIntervalMs,130);
});

test("Unity receives speed from PlayerStats and holds WASD without multi-step flooding", () => {
  const handler=unity("Networking/Handlers/PlayerStatsHandler.cs");
  const dto=unity("Data/PlayerStatsData.cs");
  const controller=unity("Player/PlayerController.cs");
  const selector=unity("Combat/TargetSelector.cs");
  assert.match(handler,/SetMoveIntervalMs\(stats\.moveIntervalMs\)/);
  assert.match(dto,/public int moveIntervalMs;/);
  assert.match(controller,/public void SetMoveIntervalMs\(int milliseconds\)/);
  assert.match(controller,/moveNorth\.IsPressed\(\)/);
  assert.doesNotMatch(controller,/moveNorth\.performed\s*\+=/);
  assert.match(controller,/followPending && Time\.unscaledTime - followSentAt < FollowAckTimeoutSeconds/);
  assert.match(selector,/nextFollowStepTime = Time\.time \+ PlayerController\.Instance\.FollowIntervalSeconds;/);
});
