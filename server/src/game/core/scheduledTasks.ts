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
  /** Espera um processamento de guildas já iniciado, antes de fechar o banco. */
  waitForIdle(): Promise<void>;
}

// A aplicação ainda inicia um jogador, mas o scheduler consulta dinamicamente
// todos os personagens do mundo a cada ciclo (futuros logins/logouts).
// Um controlador ativo evita timers duplicados no processo.
let activeTasks: ScheduledTasksHandle | undefined;

/** Inicia o autosave e a rotina de guildas (idempotente até stop()). */
export function startScheduledTasks(
  players: Player | (() => readonly Player[]),
  deps: ScheduledTaskDependencies = {},
): ScheduledTasksHandle {
  if (activeTasks) {
    Logger.warn("[SCHEDULED] Tarefas já iniciadas; ignorando nova chamada.");
    return activeTasks;
  }

  // Compatibilidade com testes/chamadores antigos que passam um Player isolado.
  const getPlayers = typeof players === "function" ? players : () => [players];
  const save = deps.saveCharacter ?? ((p: Player) => DatabasePersistence.saveCharacter(p));
  const processGuilds = deps.processGuildInactivity ?? (() => GuildService.processInactivity());
  const schedule = deps.schedule ?? ((callback, ms) => setInterval(callback, ms));
  const cancel = deps.cancel ?? ((timer) => clearInterval(timer));

  let stopped = false;
  let saveInFlight: Promise<void> | undefined;
  let guildInFlight: Promise<void> | undefined;
  let finalSave: Promise<void> | undefined;

  /**
   * Um ciclo salva cada UUID ativo no máximo uma vez. Personagens distintos
   * podem salvar em paralelo; o próximo ciclo só começa quando TODOS terminarem.
   * Promise.allSettled impede que a falha de A cancele a gravação de B.
   */
  const runSave = (): Promise<void> => {
    if (saveInFlight) return saveInFlight;

    const task = Promise.resolve().then(async () => {
      const activePlayers = new Map<string, Player>();
      for (const current of getPlayers()) {
        activePlayers.set(current.id, current);
      }

      const results = await Promise.allSettled(
        [...activePlayers.values()].map(async (current) => {
          try {
            await save(current);
            Logger.system(`[AUTOSAVE] ${current.name} salvo.`);
          } catch (error) {
            Logger.error(`[AUTOSAVE] Falha ao salvar ${current.name}: ${String(error)}`);
            throw error;
          }
        }),
      );

      const failures = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      if (failures.length === 1) throw failures[0].reason;
      if (failures.length > 1) {
        throw new Error(`[AUTOSAVE] ${failures.length} personagens falharam no ciclo.`);
      }
    });
    saveInFlight = task;

    // Trata erro de timer sem gerar unhandledRejection; flush ainda recebe a falha.
    void task.then(
      () => { saveInFlight = undefined; },
      (error: unknown) => {
        saveInFlight = undefined;
        Logger.error(`[AUTOSAVE] Ciclo incompleto: ${String(error)}`);
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

  // Se o segundo agendamento falhar, o autosave já foi registrado e precisa
  // ser desfeito. Caso contrário, fica um timer órfão após falha no boot.
  let guildTimer: Timer;
  try {
    guildTimer = schedule(() => {
      if (!stopped) runGuilds();
    }, SCHEDULED_INTERVALS.guildInactivity);
  } catch (error) {
    stopped = true;
    cancel(autosaveTimer);
    throw error;
  }

  const controller: ScheduledTasksHandle = {
    async waitForIdle(): Promise<void> {
      // O processo não deve destruir o DataSource com operações de guilda em curso.
      // Falhas são logadas nos callbacks e propagadas ao shutdown.
      if (guildInFlight) await guildInFlight;
    },

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
  Logger.system("[SCHEDULED] Autosave de todos os jogadores a cada 60s; guildas a cada 24h.");
  return controller;
}
