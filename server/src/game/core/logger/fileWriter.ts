import fs from "fs";
import path from "path";
import { LoggerConfig } from "./loggerConfig";
import { LogChannel } from "../../../shared/enums/logChannel.enum";

/**
 * Escreve logs em arquivos com rotação por dia.
 */
export class FileWriter {
  private static basePath = path.join(process.cwd(), "logs");

  private static ensureDir() {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  private static getFileName(channel: LogChannel): string {
    if (!LoggerConfig.rotation) {
      return `${channel}.log`;
    }

    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    return `${channel}-${date}.log`;
  }

  static write(channel: LogChannel, line: string) {
    this.ensureDir();

    const file = path.join(this.basePath, this.getFileName(channel));

    fs.appendFileSync(file, line + "\n");
  }
}
