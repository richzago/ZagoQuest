/** Registro do mundo ativo para conciliar REST e gameplay, sem depender do socket. */
import type { Player } from "../entities/player";

type Binding = { getPlayers: () => readonly Player[]; notifyGold?: (player: Player) => void };
export class OnlinePlayerDirectory {
  private static active: Binding | undefined;
  static bind(getPlayers: () => readonly Player[], notifyGold?: (player: Player) => void): () => void {
    if (this.active) throw new Error("[PERSISTENCE] Já existe um mundo registrado.");
    const binding: Binding = { getPlayers, notifyGold };
    this.active = binding;
    return () => { if (this.active === binding) this.active = undefined; };
  }
  static findByName(name: string): Player | undefined {
    return this.active?.getPlayers().find((player) => player.name === name);
  }
  static notifyGold(player: Player): void {
    this.active?.notifyGold?.(player);
  }
}
