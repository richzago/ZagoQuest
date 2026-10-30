# Draining handlers after socket disconnect

Each WebSocket has an `OrderedMessageQueue` to serialize asynchronous handlers. Prior to this fix, `ws.on("close")` removed the queue from `messageQueues` immediately, even when a handler had started and had not finished. A later server shutdown did not see that queue and could begin final autosave too early.

The socket is still removed from `clients` and broadcast subscriptions on disconnect; it cannot control the player again. Its queue remains temporarily tracked **only while work is pending**. When the queue becomes idle it is removed. `WebSocketServer.close()` continues waiting for all tracked queues before the save/DB shutdown phase.

The additional test in `server/tests/lifecycleSocket.test.ts` starts a real WebSocket connection and an intentionally blocked handler, disconnects the client and verifies shutdown does not finish until the handler is released.

Run `cd server && npm ci && npm run build && npm test` and verify the GitHub Actions result.

**Remaining:** a handler must honor the transport's stopping flag before doing late irreversible work; DB mutations initiated while the socket was still connected are not cancellable. A process-level shutdown timeout and real PostgreSQL transactions remain separate concerns.

[Notion audit](https://app.notion.com/p/409ec07d7c4f8158ae8cf46c4b10ac2c).