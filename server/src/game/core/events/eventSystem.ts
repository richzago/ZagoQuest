/**
 * eventSystem.ts
 *
 * Sistema de eventos singleton (pub/sub).
 * Permite registrar listeners (on) e disparar eventos (emit) de forma desacoplada.
 *
 * @module game/core/events/EventSystem
 */

import { Logger } from "../logger/logger";

type EventCallback<T = any> = (data: T) => void;

/**
 * Sistema de eventos singleton.
 * Responsável por gerenciar a comunicação entre diferentes partes do jogo sem acoplamento direto.
 *
 * @example
 * ```typescript
 * // Registrar um listener
 * EventSystem.getInstance().on(GameEvent.PLAYER_LEVEL_UP, (data) => {
 *   console.log(`${data.playerName} subiu para o nível ${data.newLevel}`);
 * });
 *
 * // Disparar o evento
 * EventSystem.getInstance().emit(GameEvent.PLAYER_LEVEL_UP, {
 *   playerName: "Richard",
 *   oldLevel: 1,
 *   newLevel: 2
 * });
 * ```
 */
export class EventSystem {
  private static instance: EventSystem;
  private listeners: Map<string, EventCallback[]> = new Map();

  private constructor() {}

  /**
   * Retorna a instância única do EventSystem (Singleton).
   *
   * @returns {EventSystem} A instância do sistema de eventos
   */
  static getInstance(): EventSystem {
    if (!EventSystem.instance) {
      EventSystem.instance = new EventSystem();
    }
    return EventSystem.instance;
  }

  /**
   * Registra um callback para um evento específico.
   *
   * @param event - Nome/constante do evento (ex: GameEvent.MONSTER_DEATH)
   * @param callback - Função chamada quando o evento ocorrer
   * @returns {void}
   *
   * @example
   * ```typescript
   * eventSystem.on("monster:death", (data) => {
   *   console.log(`Monstro ${data.monsterName} morreu!`);
   * });
   * ```
   */
  on<T>(event: string, callback: EventCallback<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Remove um callback previamente registrado.
   *
   * @param event - Nome do evento
   * @param callback - A mesma função que foi registrada com `on`
   * @returns {void}
   *
   * @example
   * ```typescript
   * const handler = (data) => console.log(data);
   * eventSystem.on("event", handler);
   * // mais tarde...
   * eventSystem.off("event", handler);
   * ```
   */
  off<T>(event: string, callback: EventCallback<T>): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    const index = callbacks.indexOf(callback);
    if (index !== -1) callbacks.splice(index, 1);
    if (callbacks.length === 0) this.listeners.delete(event);
  }

  /**
   * Dispara um evento, chamando todos os listeners registrados para ele.
   *
   * @param event - Nome do evento
   * @param data - Dados enviados para os callbacks (o tipo é inferido pelo listener)
   * @returns {void}
   *
   * @remarks
   * Os callbacks são executados na ordem em que foram registrados.
   * Se algum callback lançar uma exceção, o erro é logado mas não interrompe os demais.
   *
   * @example
   * ```typescript
   * eventSystem.emit("player:levelUp", {
   *   playerName: "Richard",
   *   oldLevel: 1,
   *   newLevel: 2
   * });
   * ```
   */
  emit<T>(event: string, data: T): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks || callbacks.length === 0) return;

    // Cria uma cópia para evitar problemas se algum listener modificar o array
    const callbacksCopy = [...callbacks];
    for (const cb of callbacksCopy) {
      try {
        cb(data);
      } catch (err) {
        Logger.error(`Erro no listener do evento ${event}: ${err}`);
      }
    }
  }

  /**
   * Remove todos os listeners de um evento (ou de todos os eventos).
   *
   * @param event - (Opcional) Nome do evento. Se omitido, limpa todos os eventos.
   * @returns {void}
   *
   * @example
   * ```typescript
   * // Remove listeners de um evento específico
   * eventSystem.clear("monster:death");
   *
   * // Remove todos os listeners de todos os eventos
   * eventSystem.clear();
   * ```
   */
  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
