/**
 * Ordered, idempotent shutdown of every ZagoQuest backend resource.
 *
 * No process.exit() here: shutdown steps are testable without a real process
 * or PostgreSQL. Signal wiring lives in setupGracefulShutdown below.
 */
import { Logger } from "./logger/logger";

export interface ShutdownDependencies {
  stopGameLoop(): void;
  closeWebSocket(): Promise<void>;
  closeHttp(): Promise<void>;
  stopWorldRuntime(): void;
  waitForJobs(): Promise<void>;
  flushAutosave(): Promise<void>;
  closeDatabase(): Promise<void>;
}

export interface ShutdownController {
  shutdown(reason: string): Promise<number>;
}

export function createShutdownController(deps: ShutdownDependencies): ShutdownController {
  let pending: Promise<number> | undefined;

  return {
    shutdown(reason: string): Promise<number> {
      // SIGINT/SIGTERM or an explicit stop all share ONE final save/close.
      if (pending) return pending;

      pending = (async (): Promise<number> => {
        let failures = 0;
        Logger.system(`[SHUTDOWN] Iniciado: ${reason}`);

        const step = async (name: string, action: () => void | Promise<void>) => {
          try {
            await action();
            Logger.system(`[SHUTDOWN] ${name}: concluído.`);
          } catch (error) {
            failures++;
            Logger.error(`[SHUTDOWN] ${name}: ${String(error)}`);
          }
        };

        // Stop the game before closing the transport; no new game tick starts.
        await step("Loop de jogo", deps.stopGameLoop);
        // Stop accepting new commands and await any already-running handler.
        await step("WebSocket", deps.closeWebSocket);
        // Stop new REST requests and wait for active HTTP work.
        await step("HTTP", deps.closeHttp);
        // Remove condition/fishing/corpse timers; leave persistence values intact.
        await step("Recursos do mundo", deps.stopWorldRuntime);
        // Guild jobs must finish BEFORE destroying their repository connection.
        await step("Tarefas de guilda", deps.waitForJobs);
        // Last character save runs after commands and timers stop.
        await step("Salvamento final", deps.flushAutosave);
        // Always attempt to disconnect PostgreSQL, even if a save fails.
        await step("PostgreSQL", deps.closeDatabase);

        Logger.system(`[SHUTDOWN] Finalizado com ${failures} erro(s).`);
        return failures === 0 ? 0 : 1;
      })();

      return pending;
    },
  };
}

export type ShutdownSignal = "SIGINT" | "SIGTERM";

export interface SignalEmitter {
  on(event: ShutdownSignal, callback: () => void): unknown;
  off(event: ShutdownSignal, callback: () => void): unknown;
}

/**
 * Installs exactly one pair of handlers per call. A second signal during
 * shutdown is ignored; the first signal owns the shared Promise.
 *
 * By default only process.exitCode is set. Node exits naturally once HTTP,
 * WebSocket, timers and PostgreSQL have closed; do not forcibly exit while
 * the final save is running.
 */
export function setupGracefulShutdown(
  controller: ShutdownController,
  options: {
    emitter?: SignalEmitter;
    onComplete?: (exitCode: number) => void;
  } = {},
): () => void {
  const emitter = options.emitter ?? process;
  const onComplete = options.onComplete ?? ((code: number) => { process.exitCode = code; });
  let started = false;
  let disposed = false;

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    emitter.off("SIGINT", onSigint);
    emitter.off("SIGTERM", onSigterm);
  };

  const handle = (signal: ShutdownSignal): void => {
    if (started || disposed) return;
    started = true;
    void controller.shutdown(signal).then(
      (code) => { dispose(); onComplete(code); },
      (error) => {
        // Defensive fallback; createShutdownController handles its own steps.
        Logger.error(`[SHUTDOWN] Falha inesperada: ${String(error)}`);
        dispose();
        onComplete(1);
      },
    );
  };

  const onSigint = () => handle("SIGINT");
  const onSigterm = () => handle("SIGTERM");

  emitter.on("SIGINT", onSigint);
  emitter.on("SIGTERM", onSigterm);
  return dispose;
}
