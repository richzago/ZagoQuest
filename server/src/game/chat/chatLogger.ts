/**
 * chatLogger.ts
 * Gerencia o armazenamento de mensagens de chat e denúncias em arquivos JSON.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { Logger } from "../core/logger/logger";
import { ChatMessageLog, ReportLog } from "../../shared/interfaces/chat.interface";



/**
 * ChatLogger: responsável por salvar e carregar logs de chat e denúncias.
 * Cada dia gera um arquivo separado (ex: chat_2025-12-31.json).
 */
export class ChatLogger {
  private static readonly LOG_DIR = join(process.cwd(), "data", "chatlogs");
  private static readonly REPORT_DIR = join(process.cwd(), "data", "reports");

  /** Garante que o diretório existe. */
  private static ensureDir(dir: string): void {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  /** Retorna o caminho do arquivo para um dado diretório e prefixo, com data atual. */
  private static getDailyFilePath(baseDir: string, prefix: string): string {
    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    return join(baseDir, `${prefix}_${date}.json`);
  }

  /**
   * Salva uma mensagem de chat no arquivo do dia.
   */
  static saveMessage(log: ChatMessageLog): void {
    this.ensureDir(this.LOG_DIR);
    const filePath = this.getDailyFilePath(this.LOG_DIR, "chat");
    let logs: ChatMessageLog[] = [];
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, "utf-8");
      logs = JSON.parse(raw);
    }
    logs.push(log);
    writeFileSync(filePath, JSON.stringify(logs, null, 2));
  }

  /**
   * Salva uma denúncia no arquivo do dia.
   */
  static saveReport(report: ReportLog): void {
    this.ensureDir(this.REPORT_DIR);
    const filePath = this.getDailyFilePath(this.REPORT_DIR, "reports");
    let reports: ReportLog[] = [];
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, "utf-8");
      reports = JSON.parse(raw);
    }
    reports.push(report);
    writeFileSync(filePath, JSON.stringify(reports, null, 2));
    Logger.system(`Denúncia registrada: ${report.reporterName} -> ${report.reportedName}`);
  }
}
