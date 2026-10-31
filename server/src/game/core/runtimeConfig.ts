/**
 * Fail closed on dangerous production configuration BEFORE opening any service.
 * Development defaults remain compatible with local Unity/PG workflow.
 */
import { resolveDatabaseRuntime } from "../../api/databaseRuntime";
import { resolveApiPort } from "./httpLifecycle";

export function validateServerRuntime(env: NodeJS.ProcessEnv = process.env): void {
  const mode = env.NODE_ENV ?? "development";
  if (!["development", "test", "production"].includes(mode))
    throw new Error("NODE_ENV deve ser development, test ou production.");

  resolveDatabaseRuntime(env); // rejects DB port and production schema sync
  resolveApiPort(env.API_PORT);

  if (mode !== "production") return;

  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 ||
      /^(replace|change|example|test|dev)/i.test(env.JWT_SECRET)) {
    throw new Error("Produção exige JWT_SECRET forte (mínimo 32 caracteres).");
  }
  if (!env.DB_PASSWORD || !env.DB_PASSWORD.trim() ||
      /^(replace|change|example)/i.test(env.DB_PASSWORD)) {
    throw new Error("Produção exige DB_PASSWORD configurada.");
  }
  if (!env.DB_NAME?.trim() || !env.DB_HOST?.trim() || !env.DB_USER?.trim()) {
    throw new Error("Produção exige DB_NAME, DB_HOST e DB_USER explícitos.");
  }
  if (env.DB_LOGGING === "true") {
    throw new Error("DB_LOGGING=true é proibido em produção (pode expor dados).");
  }
}
