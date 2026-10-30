# Global event listener lifecycle

Previously every call to `registerEventListeners()` added new anonymous callbacks to the global `EventSystem`. Re-running bootstrap in the same process or reinitializing a runtime could produce duplicate logs/events and hold callbacks indefinitely.

The function is now idempotent and returns a disposer. Repeated calls return the same disposer; it removes only the listeners created by that registration. `main.ts` saves the disposer and invokes it in the final cleanup phase, including when startup partially fails.

`tests/eventListenerLifecycle.test.ts` checks exactly one reaction across duplicate registrations, none after dispose, and one after a new registration.

Other event users such as `CombatEventBridge` own their own listeners and remain unchanged. The global EventSystem singleton still exists; this PR does not redesign its architecture.

Run `cd server && npm ci && npm run build && npm test`. [Notion audit](https://app.notion.com/p/409ec07d7c4f8158ae8cf46c4b10ac2c).