/**
 * Centralny system logowania
 * Zapisuje logi do plików i bazy danych
 */

import * as fs from "fs";
import * as path from "path";

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: any;
  error?: string;
}

class Logger {
  private logDir: string;
  private moduleLogFiles: Map<string, string> = new Map();

  constructor() {
    this.logDir = path.join(process.cwd(), "logs");
    // Utwórz katalog logów jeśli nie istnieje
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogFile(module: string): string {
    if (!this.moduleLogFiles.has(module)) {
      const logFile = path.join(this.logDir, `${module}.log`);
      this.moduleLogFiles.set(module, logFile);
    }
    return this.moduleLogFiles.get(module)!;
  }

  private formatLog(entry: LogEntry): string {
    const timestamp = entry.timestamp;
    const level = entry.level.padEnd(5);
    const module = entry.module.padEnd(20);
    const message = entry.message;
    const data = entry.data ? `\n${JSON.stringify(entry.data, null, 2)}` : "";
    const error = entry.error ? `\nERROR: ${entry.error}` : "";

    return `[${timestamp}] ${level} [${module}] ${message}${data}${error}\n`;
  }

  private writeLog(entry: LogEntry) {
    const logFile = this.getLogFile(entry.module);
    const logLine = this.formatLog(entry);

    // Zapisz do pliku
    try {
      fs.appendFileSync(logFile, logLine);
    } catch (error) {
      console.error("Błąd zapisu do pliku logów:", error);
    }

    // Wyświetl w konsoli (tylko ERROR i WARN)
    if (entry.level === LogLevel.ERROR) {
      console.error(`[${entry.module}] ${entry.message}`, entry.data || "", entry.error || "");
    } else if (entry.level === LogLevel.WARN) {
      console.warn(`[${entry.module}] ${entry.message}`, entry.data || "");
    } else if (process.env.NODE_ENV === "development") {
      console.log(`[${entry.module}] ${entry.message}`, entry.data || "");
    }
  }

  log(module: string, level: LogLevel, message: string, data?: any, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      data,
      error: error ? error.message : undefined,
    };

    this.writeLog(entry);
  }

  debug(module: string, message: string, data?: any) {
    this.log(module, LogLevel.DEBUG, message, data);
  }

  info(module: string, message: string, data?: any) {
    this.log(module, LogLevel.INFO, message, data);
  }

  warn(module: string, message: string, data?: any) {
    this.log(module, LogLevel.WARN, message, data);
  }

  error(module: string, message: string, data?: any, error?: Error) {
    this.log(module, LogLevel.ERROR, message, data, error);
  }

  /**
   * Pobierz logi z modułu
   */
  getLogs(module: string, limit: number = 1000): string {
    const logFile = this.getLogFile(module);
    if (!fs.existsSync(logFile)) {
      return "";
    }

    try {
      const content = fs.readFileSync(logFile, "utf-8");
      const lines = content.split("\n").filter((line) => line.trim());
      return lines.slice(-limit).join("\n");
    } catch (error) {
      return "";
    }
  }

  /**
   * Pobierz listę dostępnych modułów
   */
  getModules(): string[] {
    if (!fs.existsSync(this.logDir)) {
      return [];
    }

    try {
      const files = fs.readdirSync(this.logDir);
      return files
        .filter((file) => file.endsWith(".log"))
        .map((file) => file.replace(".log", ""));
    } catch (error) {
      return [];
    }
  }

  /**
   * Wyczyść logi modułu
   */
  clearLogs(module: string) {
    const logFile = this.getLogFile(module);
    if (fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, "");
    }
  }
}

// Singleton instance
export const logger = new Logger();

