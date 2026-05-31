import { Logger } from "./game/core/logger/logger";
import { registerEventListeners } from "./game/core/events/eventListeners";
import { initializeGame } from "./game/loaders/gameInitializer";
import { loadNpcs } from "./game/loaders/npcLoader";
import { startAutoSave } from "./game/core/autoSave";
import { setupInput } from "./game/core/inputHandler";
import { setupGracefulShutdown } from "./game/core/shutdownHandler";
import { AsciiRenderer } from "./game/rendering/asciiRenderer";
import { startGameLoops } from "./game/core/gameLoop";

Logger.system("🔥 ZagoQuest iniciando...");
registerEventListeners();

(async () => {
  const { world, player } = await initializeGame("Richard");
  loadNpcs(world);

  const renderer = new AsciiRenderer();

  startAutoSave(player);
  setupInput(player, world);
  setupGracefulShutdown(player);
  startGameLoops(world, renderer);
})();
