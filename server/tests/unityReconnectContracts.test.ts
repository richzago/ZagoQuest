import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const unity = (name: string) => readFileSync(
  path.join(process.cwd(), "..", "Client", "Assets", "Resources", "Scripts", name), "utf8",
);

// Tests guard C# contracts; real Unity reconnection still needs Play Mode.
test("Unity reconnect is retried after close and after initial connect failures", () => {
  const manager = unity("Networking/NetworkManager.cs");
  assert.match(manager, /Time\.unscaledTime >= _nextReconnectAttempt/);
  assert.match(manager, /!isConnected && !_connecting/);
  assert.match(manager, /_ = Connect\(\)/);
  assert.match(manager, /catch \(Exception error\)/);
  assert.match(manager, /_nextReconnectAttempt = Time\.unscaledTime \+ ReconnectDelaySeconds/);
  assert.match(manager, /var socket = new WebSocket\(serverUrl\)/);
  assert.match(manager, /ReferenceEquals\(_websocket, socket\)/);
});

test("Unity resets obsolete session entities before new spawn snapshot", () => {
  const manager = unity("Networking/NetworkManager.cs");
  const entities = unity("Managers/EntityManager.cs");
  assert.match(manager, /EntityManager\.Instance\?\.ClearNetworkEntities\(\)/);
  assert.match(manager, /_lastInitPosition = null/);
  assert.match(manager, /_context = new NetworkContext\(this\)/);
  assert.match(entities, /public void ClearNetworkEntities\(\)/);
  assert.match(entities, /entities\.Clear\(\)/);
});

test("Unity stops reconnection when NetworkManager is destroyed", () => {
  const manager = unity("Networking/NetworkManager.cs");
  assert.match(manager, /_shuttingDown = true/);
  assert.match(manager, /if \(!_shuttingDown && !isConnected/);
  assert.match(manager, /if \(Instance == this\) Instance = null/);
});
