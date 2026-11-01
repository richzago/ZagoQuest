/** C15: tabela versionada para snapshot de itens no chão. Sem destruição. */
import type { MigrationInterface, QueryRunner } from "typeorm";
export class GroundItems1793600000000 implements MigrationInterface {
  readonly name = "GroundItems1793600000000";
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "ground_items" (
      "world_key" text NOT NULL,
      "id" text NOT NULL,
      "payload" jsonb NOT NULL,
      PRIMARY KEY ("world_key", "id")
    )`);
  }
  async down(): Promise<void> {
    throw new Error("Não apagar ground_items: contém Bags e itens dos jogadores.");
  }
}
