export interface SpawnPointData {
  id: string;
  monsterId: string; // ex: "animals/lowlevel/rat"
  x: number;
  y: number;
  respawnTimeMs: number; // tempo para renascer após morte
  initialDelayMs?: number; // atraso inicial para spawn
}
