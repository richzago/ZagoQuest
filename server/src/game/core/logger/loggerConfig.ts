import { LogLevel } from "./logLevel";
import { LogChannel } from "./logChannel";

export const LoggerConfig = {
  debug: true,

  level: LogLevel.DEBUG,

  fileLogging: true,

  rotation: true,

  enabledChannels: [
    LogChannel.SYSTEM,
    LogChannel.COMBAT,
    LogChannel.AI,
    LogChannel.WORLD,
    LogChannel.ECONOMY,
    LogChannel.SKILL,
    LogChannel.LOOT,
  ],
};
