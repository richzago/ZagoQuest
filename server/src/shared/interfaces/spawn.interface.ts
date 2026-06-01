export interface SpawnPointData {
  id: string;
  monsterId: string;
  x: number;
  y: number;
  respawnTimeMs: number;
  initialDelayMs?: number;
}

// ActiveSpawn é usada internamente no spawnSystem; pode ficar lá ou ser exportada
export interface ActiveSpawn {
  data: SpawnPointData;
  monsterId?: number;
  respawnTimer?: NodeJS.Timeout;
  pendingRespawn: boolean;
}
