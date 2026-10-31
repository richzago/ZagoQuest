import { LogChannel } from "../../../shared/enums/logChannel.enum";
import { LogLevel } from "../../../shared/enums/logLevel.enum";
import { FileWriter } from "./fileWriter";
import { LoggerConfig } from "./loggerConfig";
import { formatLog } from "./utils/formatLog";
import { redactLogMessage } from "./logRedaction";

export class Logger {
  private static consoleEnabled: boolean = true;

  private static shouldLog(level: LogLevel): boolean {
    // Mapeamento dos níveis reais (ignora ECONOMY, SKILL, LOOT que são canais)
    const order: { [key: string]: number } = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3,
    };
    const levelValue = order[level] ?? 1; // fallback para INFO
    const configValue = order[LoggerConfig.level] ?? 1;
    return levelValue >= configValue;
  }

  private static write(level: LogLevel, channel: LogChannel, message: string) {
    // Alertas de infraestrutura são essenciais inclusive se DEBUG estiver off.
    const critical = level === LogLevel.WARN || level === LogLevel.ERROR;
    if (!critical && !LoggerConfig.debug) return;
    if (!critical && !this.shouldLog(level)) return;
    if (!critical && !LoggerConfig.enabledChannels.includes(channel)) return;

    const line = formatLog(LogLevel[level], channel, redactLogMessage(message));

    if (Logger.consoleEnabled) {
      console.log(line);
    }

    if (LoggerConfig.fileLogging) {
      try {
        FileWriter.write(channel, line);
      } catch (error) {
        // Nunca derrubar o loop ou o shutdown se o disco de logs lotou.
        console.error(formatLog("ERROR", "system",
          redactLogMessage(`[LOGGER] Falha ao gravar log: ${String(error)}`)));
      }
    }
  }

  static setConsoleOutput(enabled: boolean): void {
    Logger.consoleEnabled = enabled;
  }

  // =========================
  // SYSTEM
  // =========================
  static system(msg: string) {
    this.write(LogLevel.INFO, LogChannel.SYSTEM, msg);
  }
  static warn(msg: string) {
    this.write(LogLevel.WARN, LogChannel.SYSTEM, msg);
  }
  static error(msg: string) {
    this.write(LogLevel.ERROR, LogChannel.SYSTEM, msg);
  }

  // =========================
  // COMBAT
  // =========================
  static combat(msg: string) {
    this.write(LogLevel.INFO, LogChannel.COMBAT, msg);
  }

  // =========================
  // AI
  // =========================
  static ai(msg: string) {
    this.write(LogLevel.DEBUG, LogChannel.AI, msg);
  }

  // =========================
  // WORLD
  // =========================
  static world(msg: string) {
    this.write(LogLevel.INFO, LogChannel.WORLD, msg);
  }

  // =========================
  // ECONOMY
  // =========================
  static economy(msg: string) {
    this.write(LogLevel.INFO, LogChannel.ECONOMY, msg);
  }

  // =========================
  // SKILL
  // =========================
  static skill(msg: string) {
    this.write(LogLevel.INFO, LogChannel.SKILL, msg);
  }

  // =========================
  // LOOT
  // =========================
  static loot(msg: string) {
    this.write(LogLevel.INFO, LogChannel.LOOT, msg);
  }
}
