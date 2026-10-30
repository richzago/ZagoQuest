/**
 * Agendamentos periódicos do servidor.
 *
 * Regras:
 * 1. Intervalos em milissegundos (ms).
 * 2. A mesma tarefa nunca executa duas vezes em paralelo.
 * 3. Erros são registrados, sem derrubar o processo.
 * 4. stop() limpa timers; flushAutosave() garante um último save no shutdown.
 *
 * A implementação usa apenas timers do Node, sem dependências extras.
 */
import type { Player } from "../entities/player";
import { Logger } from "./logger/logger";
import { DatabasePersistence } from "../systems/databasePersistence";
import { GuildService } from "../../api/services/guildService";

export const SCHEDULED_INTERVALS = {
  autosave: 60 * 1000,           // 1 minuto
  guildInactivity: 24 * 60 * 60 * 1000, // 24 horas
} as const;

type Timer = ReturnType<typeof setInterval>;

/** Dependências injetáveis para testar sem PostgreSQL nem esperar 24 horas. */
export interface ScheduledTaskDependencies {
  saveCharacter?: (player: Player) => Promise<void>;
  processGuildInactivity?: () => Promise<void>;
  schedule?: (callback: () => void, intervalMs: number) => Timer;
  cancel?: (timer: Timer) => void;
}

export interface ScheduledTasksHandle {
  /** Não inicia novas tarefas; uma execução em andamento pode terminar. */
  stop(): void;
  /** Para os timers, espera eventual autosave e salva o estado mais recente. */
  flushAutosave(): Promise<void>;
}

// A aplicação atual possui um único mundo e um jogador inicial.
// Um controlador ativo evita duplicar autosave e processamento de guildas.
let activeTasks: ScheduledTasksHandle | undefined;

/** Inicia o autosave e a rotina de guildas (idempotente até stop()). */
export function startScheduledTasks(
  player: Player,
  deps: ScheduledTaskDependencies = {},
): ScheduledTasksHandle {
  if (activeTasks) {
    Logger.warn("[SCHEDULED] Tarefas já iniciadas; ignorando nova chamada.");
    return activeTasks;
  }

  const save = deps.saveCharacter ?? ((p: Player) => DatabasePersistence.saveCharacter(p));
  const processGuilds = deps.processGuildInactivity ?? (() => GuildService.processInactivity());
  const schedule = deps.schedule ?? ((callback, ms) => setInterval(callback, ms));
  const cancel = deps.cancel ?? ((timer) => clearInterval(timer));

  let stopped = false;
  let saveInFlight: Promise<void> | undefined;
  let guildInFlight: Promise<void> | undefined;
  let finalSave: Promise<void> | undefined;

  /** Retorna a Promise já ativa em vez de iniciar um segundo salvamento. */
  const runSave = (): Promise<void> => {
    if (saveInFlight) return saveInFlight;

    const task = Promise.resolve().then(() => save(player));
    saveInFlight = task;

    // Trata erros de tarefas disparadas pelo timer; flush também pode await.
    void task.then(
      () => {
        saveInFlight = undefined;
        Logger.system(`[AUTOSAVE] ${player.name} salvo.`);
      },
      (error: unknown) => {
        saveInFlight = undefined;
        Logger.error(`[AUTOSAVE] Falha ao salvar ${player.name}: ${String(error)}`);
      },
    );
    return task;
  };

  /** Evita executar uma segunda revisão de guildas com a primeira pendente. */
  const runGuilds = (): void => {
    if (guildInFlight) return;

    const task = Promise.resolve().then(() => processGuilds());
    guildInFlight = task;
    void task.then(
      () => {
        guildInFlight = undefined;
        Logger.system("[SCHEDULED] Inatividade de guildas processada.");
      },
      (error: unknown) => {
        guildInFlight = undefined;
        Logger.error(`[SCHEDULED] Falha ao processar guildas: ${String(error)}`);
      },
    );
  };

  const autosaveTimer = schedule(() => {
    if (!stopped && !saveInFlight) void runSave();
  }, SCHEDULED_INTERVALS.autosave);
  const guildTimer = schedule(() => {
    if (!stopped) runGuilds();
  }, SCHEDULED_INTERVALS.guildInactivity);

  const controller: ScheduledTasksHandle = {
    stop(): void {
      if (stopped) return;
      stopped = true;
      cancel(autosaveTimer);
      cancel(guildTimer);
      if (activeTasks === controller) activeTasks = undefined;
    },

    flushAutosave(): Promise<void> {
      if (finalSave) return finalSave; // Dois sinais não geram dois saves finais.
      controller.stop();
      finalSave = (async () => {
        // O save final precisa acontecer DEPOIS do save em andamento.
        // Se o anterior falhou, ainda tentamos salvar o estado mais recente.
        if (saveInFlight) {
          try {
            await saveInFlight;
          } catch {
            // Falha já registrada por runSave; a próxima tentativa é decisiva.
          }
        }
        await runSave();
      })();
      return finalSave;
    },
  };

  activeTasks = controller;
  Logger.system("[SCHEDULED] Autosave a cada 60s; guildas a cada 24h.");
  return controller;
}
