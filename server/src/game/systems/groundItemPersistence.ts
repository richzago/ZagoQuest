/**
 * C15 — persistência do chão em PostgreSQL.
 *
 * Fluxo de escrita serializado por mundo, com snapshots atômicos na tabela
 * e UUIDs/BagState preservados. Não apagar estado em caso de erro DB.
 * A tabela é criada de modo não destrutivo para instalações legadas.
 */
import { AppDataSource } from "../../api/data-source";
import { ItemOnGround } from "../entities/itemOnGround";
import type { World } from "../world/World";
import { Logger } from "../core/logger/logger";
import type { BagStateSave } from "../entities/player";

export interface GroundRow {
  id: string;
  itemId: string;
  amount: number;
  x: number;
  y: number;
  itemName: string;
  bagState?: BagStateSave;
}
const queues = new WeakMap<World, Promise<void>>();
const worldName = "main";
export class GroundItemPersistence {
  static serialize(world: World): GroundRow[] {
    return world.itemsOnGround.map(item => ({
      id:item.id, itemId:item.itemId, amount:item.amount,
      x:item.position.x, y:item.position.y, itemName:item.itemName,
      ...(item.bagState ? {bagState:item.bagState} : {}),
    }));
  }

  static parse(rows: unknown, world: World): ItemOnGround[] {
    if (!Array.isArray(rows)) throw Error("Snapshot de chão não é array");
    const seen = new Set<string>();
    const recovered: ItemOnGround[] = [];
    for (const entry of rows) {
      const r = entry as Partial<GroundRow> | null;
      if (!r || typeof r.id !== "string" || !r.id ||
          seen.has(r.id) || typeof r.itemId !== "string" || !r.itemId ||
          !Number.isSafeInteger(r.amount) || r.amount! <= 0 ||
          !world.isWithinBounds(r.x!,r.y!) || typeof r.itemName !== "string")
        throw Error("Snapshot de chão inválido; abortando restauração sem apagar itens");
      seen.add(r.id);
      const item = new ItemOnGround(r.id,r.itemId,r.amount!,r.x!,r.y!,r.itemName);
      if (r.bagState) item.bagState = r.bagState;
      recovered.push(item);
    }
    return recovered;
  }

  private static async ensureSchema(): Promise<void> {
    await AppDataSource.query(`CREATE TABLE IF NOT EXISTS "ground_items" (
      "world_key" text NOT NULL, "id" text NOT NULL, "payload" jsonb NOT NULL,
      PRIMARY KEY ("world_key","id")
    )`);
  }

  static async restore(world: World): Promise<void> {
    if (!AppDataSource.isInitialized) return;
    await this.ensureSchema();
    const rows: Array<{payload: GroundRow}> = await AppDataSource.query(
      'SELECT "payload" FROM "ground_items" WHERE "world_key" = $1 ORDER BY "id"',
      [worldName],
    );
    const restored = this.parse(rows.map(r=>r.payload),world);
    world.itemsOnGround.splice(0,world.itemsOnGround.length,...restored);
    Logger.world(`[C15] Restaurados ${restored.length} itens do chão com UUIDs.`);
  }

  static bind(world: World): void {
    world.onGroundItemsChanged = () => this.schedule(world);
  }

  static schedule(world: World): void {
    if (!AppDataSource.isInitialized) return;
    // Capturar já: writes concorrentes nunca podem aplicar estado obsoleto.
    const snapshot = this.serialize(world);
    const previous = queues.get(world) ?? Promise.resolve();
    const job = previous.catch(()=>undefined).then(()=>this.write(snapshot));
    queues.set(world, job);
    void job.catch(error=>Logger.error(`[C15][GROUND] Falha ao persistir: ${String(error)}`));
  }

  private static async write(snapshot: GroundRow[]): Promise<void> {
    await AppDataSource.transaction(async manager => {
      await manager.query('DELETE FROM "ground_items" WHERE "world_key" = $1',[worldName]);
      for (const item of snapshot)
        await manager.query(
          'INSERT INTO "ground_items" ("world_key","id","payload") VALUES ($1,$2,$3::jsonb)',
          [worldName,item.id,JSON.stringify(item)],
        );
    });
  }

  static async flush(world: World): Promise<void> {
    if (!AppDataSource.isInitialized) return;
    await (queues.get(world) ?? Promise.resolve());
    // Gravar snapshot final mesmo que operações tenham sido feitas em teste
    // ou por scripts que nunca instalaram o callback.
    await this.write(this.serialize(world));
  }
}
