/** Safe upgrade for an existing PostgreSQL characters table. Never drops data. */
import type { MigrationInterface, QueryRunner } from "typeorm";
export class ContainerInstances1793500000000 implements MigrationInterface {
  readonly name = "ContainerInstances1793500000000";
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "containerState" jsonb NOT NULL DEFAULT '{}'`
    );
  }
  async down(): Promise<void> {
    throw new Error("Não apagar containerState de personagens reais: restaurar backup manual.");
  }
}
