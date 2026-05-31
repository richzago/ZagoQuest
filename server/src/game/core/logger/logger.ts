import { LogLevel } from "./logLevel";
import { LogChannel } from "./logChannel";
import { FileWriter } from "./fileWriter";
import { LoggerConfig } from "./loggerConfig";
import { formatLog } from "./utils/formatLog";

export class Logger {
  private static shouldLog(level: LogLevel): boolean {
    const order = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      ECONOMY: 4,
      SKILL: 5,
      LOOT: 6,
    };

    return order[level] >= order[LoggerConfig.level];
  }

  private static write(level: LogLevel, channel: LogChannel, message: string) {
    if (!LoggerConfig.debug) return;
    if (!this.shouldLog(level)) return;

    if (!LoggerConfig.enabledChannels.includes(channel)) {
      return;
      // LoggerConfig.enabledChannels = ["combat"];
    }

    const levelName = LogLevel[level];

    const line = formatLog(levelName, channel, message);

    // console bonito
    console.log(line);

    // arquivo
    if (LoggerConfig.fileLogging) {
      FileWriter.write(channel, line);
    }
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
    console.log("ECONOMY LOG:", msg); // ← teste temporário
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
