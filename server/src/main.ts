/**
 * Entry point for the ZagoQuest backend.
 *
 * The bootstrap OWNS every resource it opens. Game loops no longer install
 * process signal handlers or call process.exit(). Any startup failure uses
 * the same cleanup sequence as Ctrl+C or SIGTERM.
 */
import "reflect-metadata";

import type { Server as HttpServer } from "node:http";
import { join } from "node:path";
import { startApi } from "./api/server";
import { AppDataSource } from "./api/data-source";
import { ConditionRegistry } from "./data/items/conditions/conditionRegistry";
import { MonsterRegistry } from "./data/monsters/monsterRegistry";
import { ItemRegistry } from "./data/items/itemRegistry";
import { registerEventListeners } from "./game/core/events/eventListeners";
import { createWorldAndPlayer } from "./game/initialization/worldFactory";
import { startGameLoops, type GameLoopsHandle } from "./game/core/gameStarter";
import { stopWorldRuntime } from "./game/core/worldCleanup";
import {
  createShutdownController,
  setupGracefulShutdown,
} from "./game/core/shutdownHandler";
import { closeHttp, listenHttp, resolveApiPort } from "./game/core/httpLifecycle";
import { Logger } from "./game/core/logger/logger";
import type { World } from "./game/world/World";
import { WebSocketServer } from "./network/websocket/wsServer";
import { OnlinePlayerDirectory } from "./game/systems/onlinePlayerDirectory";
import { validateServerRuntime } from "./game/core/runtimeConfig";

async function bootstrap(): Promise<void> {
  let httpServer: HttpServer | undefined;
  let wsServer: WebSocketServer | undefined;
  let world: World | undefined;
  let gameLoops: GameLoopsHandle | undefined;
  let disposeListeners: (() => void) | undefined;
  let disposeDirectory: (() => void) | undefined;

  // Always close resources in the reverse direction of startup, even if
  // a later step fails; failed steps do not prevent a final DB close.
  const shutdown = createShutdownController({
    stopGameLoop: () => gameLoops?.stop(),
    closeWebSocket: async () => { if (wsServer) await wsServer.close(); },
    closeHttp: () => closeHttp(httpServer),
    stopWorldRuntime: () => { if (world) stopWorldRuntime(world); },
    waitForJobs: async () => { if (gameLoops) await gameLoops.waitForTasks(); },
    flushAutosave: async () => { if (gameLoops) await gameLoops.flushAutosave(); },
    closeDatabase: async () => {
      try {
        if (AppDataSource.isInitialized) await AppDataSource.destroy();
      } finally {
        disposeDirectory?.();
        disposeListeners?.();
      }
    },
  });

  try {
    validateServerRuntime();
    Logger.system("ZagoQuest iniciando...");
    disposeListeners = registerEventListeners();
    ConditionRegistry.load();
    MonsterRegistry.loadAll();

    const itemsRoot = join(process.cwd(), "src", "data", "items");
    ItemRegistry.loadAll(itemsRoot);
    Logger.system("Registros de condições, monstros e itens carregados.");

    // startApi connects PostgreSQL and returns an HTTP server NOT listening.
    httpServer = await startApi();

    const characterName = process.env.CHARACTER_NAME || "Richard";
    const authenticatedSessions = process.env.NODE_ENV === "production" ||
      process.env.WS_AUTH_REQUIRED === "true";
    const initialized = await createWorldAndPlayer(characterName, {
      skipBootstrapPlayer: authenticatedSessions,
    });
    world = initialized.world;
    // REST e WebSocket devem referenciar o MESMO Player vivo.
    disposeDirectory = OnlinePlayerDirectory.bind(
      () => world!.players,
      (player) => wsServer?.sendToPlayer(player.id, JSON.stringify({ type: "gold", gold: player.gold })),
    );

    // WebSocket shares the same HTTP server and world.
    wsServer = new WebSocketServer(httpServer, world);

    // Listen may reject asynchronously (EADDRINUSE/EACCES). Do not start
    // scheduled jobs if the HTTP server has not successfully bound the port.
    const port = resolveApiPort(process.env.API_PORT);
    await listenHttp(httpServer, port);

    gameLoops = startGameLoops(world, initialized.player, wsServer);
    setupGracefulShutdown(shutdown);
    Logger.system(authenticatedSessions
      ? `API + WebSocket na porta ${port}; aguardando login autenticado.`
      : `API + WebSocket na porta ${port}; personagem legado: ${characterName}.`);
  } catch (error) {
    Logger.error(`Falha no bootstrap: ${String(error)}`);
    // Includes partially opened WebSocket, HTTP and PostgreSQL resources.
    await shutdown.shutdown("BOOTSTRAP_FAILURE");
    process.exitCode = 1;
  }
}

void bootstrap().catch((error) => {
  // Defensive only: bootstrap itself already handles startup errors.
  Logger.error(`Falha inesperada no bootstrap: ${String(error)}`);
  process.exitCode = 1;
});
