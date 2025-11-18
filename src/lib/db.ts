import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Konfiguracja PrismaClient z timeoutem dla SQLite
export const db = global.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  // SQLite ma domyślny timeout 5 sekund, ale możemy go zwiększyć
  // Uwaga: SQLite nie obsługuje równoległych zapisów dobrze - operacje są sekwencyjne
});

if (process.env.NODE_ENV !== "production") global.prisma = db;



