import { LogChannel } from "../../../shared/enums/logChanel.enum";
import { LogLevel } from "../../../shared/enums/logLevel.enum";

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
