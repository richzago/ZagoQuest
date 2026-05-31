import { Logger } from "../logger/logger";

type EventCallback<T = any> = (data: T) => void;

/**
 * Sistema de eventos singleton.
 * Permite registrar listeners (on) e disparar eventos (emit).
 */
export class EventSystem {
  private static instance: EventSystem;
  private listeners: Map<string, EventCallback[]> = new Map();

  private constructor() {}

  static getInstance(): EventSystem {
    if (!EventSystem.instance) {
      EventSystem.instance = new EventSystem();
    }
    return EventSystem.instance;
  }

  /**
   * Registra um callback para um evento específico.
   * @param event Nome/constante do evento
   * @param callback Função chamada quando o evento ocorrer
   */
  on<T>(event: string, callback: EventCallback<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Remove um callback previamente registrado.
   */
  off<T>(event: string, callback: EventCallback<T>): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    const index = callbacks.indexOf(callback);
    if (index !== -1) callbacks.splice(index, 1);
    if (callbacks.length === 0) this.listeners.delete(event);
  }

  /**
   * Dispara um evento, chamando todos os listeners registrados.
   * @param event Nome do evento
   * @param data Dados enviados para os callbacks
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
   * Remove todos os listeners de um evento (útil para recarregar scripts).
   */
  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
