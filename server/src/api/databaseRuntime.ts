/**
 * Runtime database policy. Schema synchronization is an explicit, local-only
 * convenience; production databases must use reviewed migrations.
 */
export function resolveDatabaseRuntime(env: NodeJS.ProcessEnv = process.env) {
  const rawPort = env.DB_PORT ?? "5432";
  if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) {
    throw new Error("DB_PORT deve ser uma porta TCP válida (1–65535).");
  }
  if (env.NODE_ENV === "production" && env.DB_SYNCHRONIZE === "true") {
    throw new Error("DB_SYNCHRONIZE=true é proibido em produção. Utilize migrations.");
  }

  return {
    port: Number(rawPort),
    synchronize: env.NODE_ENV === "development" && env.DB_SYNCHRONIZE === "true",
    logging: env.DB_LOGGING === "true",
  };
}
