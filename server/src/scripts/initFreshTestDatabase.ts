/** One-time initializer for a completely EMPTY, explicitly disposable PostgreSQL database.
 * Never creates a database and never changes any existing schema. */
import { AppDataSource } from "../api/data-source";

export function validateFreshTestDatabaseTarget(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV !== "development" ||
      env.DB_SYNCHRONIZE !== "false" ||
      env.ALLOW_FRESH_TEST_SCHEMA !== "true" ||
      !["zagoquest_test", "zagoquest_ci"].includes(env.DB_NAME ?? "") ||
      !["localhost", "127.0.0.1", "::1"].includes(env.DB_HOST ?? "")) {
    throw new Error(
      "Operação recusada: exige NODE_ENV=development, DB_SYNCHRONIZE=false, " +
      "ALLOW_FRESH_TEST_SCHEMA=true, DB_NAME=zagoquest_test ou zagoquest_ci e DB_HOST local.",
    );
  }
}

export async function initializeFreshTestDatabase(): Promise<void> {
  validateFreshTestDatabaseTarget(process.env);
  if (AppDataSource.options.synchronize) throw new Error("Schema sync deve estar desabilitado.");
  await AppDataSource.initialize();
  try {
    const [{ name }] = await AppDataSource.query('SELECT current_database() AS "name"') as Array<{ name: string }>;
    if (name !== process.env.DB_NAME) throw new Error("Database conectada diferente da configuração.");
    const existing = await AppDataSource.query(`
      SELECT tablename FROM pg_catalog.pg_tables
      WHERE schemaname = 'public' ORDER BY tablename LIMIT 1
    `) as Array<{ tablename: string }>;
    if (existing.length > 0) {
      throw new Error(
        "Database já contém tabelas: inicialização bloqueada para preservar dados. " +
        "Utilize somente uma database nova, vazia e descartável.",
      );
    }
    const applied = await AppDataSource.runMigrations({ transaction: "all" });
    if (applied.length !== 1 || applied[0].name !== "InitialSchema1793400000000")
      throw new Error("A migration baseline esperada não foi aplicada.");
    console.log("[TEST_DB] Schema inicial aplicado na database descartável. DB_SYNCHRONIZE segue false.");
  } finally {
    await AppDataSource.destroy();
  }
}

if (require.main === module) {
  void initializeFreshTestDatabase().catch((error) => {
    console.error("[TEST_DB] " + (error instanceof Error ? error.message : "Falha desconhecida."));
    process.exitCode = 1;
  });
}
