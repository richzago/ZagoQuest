import assert from "node:assert/strict";
import { test } from "node:test";
import { registerEventListeners } from "../src/game/core/events/eventListeners";
import { EventSystem } from "../src/game/core/events/eventSystem";
import { GameEvent } from "../src/shared/enums/gameEvent.enum";
import { Logger } from "../src/game/core/logger/logger";

test("global listeners register once, dispose cleanly and support restart", (t) => {
  let calls = 0;
  t.mock.method(Logger, "combat", () => { calls++; });
  const first = registerEventListeners();
  try {
    const second = registerEventListeners();
    assert.equal(first, second);
    const kill = { killerId: "a", killerName: "A", victimId: "b", victimName: "B" };
    EventSystem.getInstance().emit(GameEvent.COMBAT_KILL, kill);
    assert.equal(calls, 1, "duplicate bootstraps must not duplicate event listeners");

    first();
    second();
    EventSystem.getInstance().emit(GameEvent.COMBAT_KILL, kill);
    assert.equal(calls, 1, "dispose removes listeners");

    const third = registerEventListeners();
    assert.notEqual(third, first);
    EventSystem.getInstance().emit(GameEvent.COMBAT_KILL, kill);
    assert.equal(calls, 2, "a new bootstrap re-registers only one listener");
    third();
  } finally {
    first();
  }
});
