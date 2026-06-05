/**
 * playerLoader.ts
 *
 * Responsável por carregar ou criar um jogador a partir do banco de dados,
 * reposicioná-lo no spawn definido pelo mapa e atualizar informações de guildas.
 *
 * @module game/loaders/playerLoader
 */

import { Player } from "../entities/player";
import { DatabasePersistence } from "../systems/databasePersistence";
import { GuildService } from "../../api/services/guildService";
import { Logger } from "../core/logger/logger";
import { PlayerSpawnData } from "../../shared/interfaces/spawn.interface";

/**
 * Loader especializado para criação/carregamento do jogador.
 */
export class PlayerLoader {
  /**
   * Carrega um jogador existente ou cria um novo, e o posiciona no spawn.
   *
   * @param playerName - Nome do personagem (único).
   * @param spawnPosition - Posição (x, y) onde o jogador deve nascer ou ser reposicionado.
   * @returns Uma instância de Player pronta para ser adicionada ao mundo.
   *
   * @remarks
   * - Se o jogador já existe no banco, apenas atualiza sua posição e salva.
   * - Se não existe, cria um novo com nível 1, HP/MP padrão, inventário vazio.
   * - Após carregar/criar, atualiza o campo `lastSeen` na guilda (para controle de inatividade).
   *
   * @example
   * ```typescript
   * const player = await PlayerLoader.loadOrCreatePlayer("Richard", { x: 17, y: 3 });
   * world.addPlayer(player);
   * ```
   */
  static async loadOrCreatePlayer(
    playerName: string,
    spawnPosition: PlayerSpawnData,
  ): Promise<Player> {
    // Tenta carregar do banco de dados
    let player = await DatabasePersistence.loadCharacter(playerName);

    if (!player) {
      // Cria um novo jogador
      // O construtor de Player espera (id, name, x, y). O id pode ser gerado pelo banco depois.
      player = new Player(1, playerName, spawnPosition.x, spawnPosition.y);
      await DatabasePersistence.saveCharacter(player);
      Logger.system(`[PlayerLoader] Novo jogador ${player.name} criado e salvo no banco.`);
    } else {
      // Reposiciona o jogador existente para o spawn atual do mapa (evita ficar preso em obstáculos)
      player.position.x = spawnPosition.x;
      player.position.y = spawnPosition.y;
      await DatabasePersistence.saveCharacter(player);
      Logger.system(
        `[PlayerLoader] Jogador ${player.name} carregado do banco e reposicionado em (${spawnPosition.x}, ${spawnPosition.y}).`,
      );
    }

    // Atualiza o timestamp da última atividade na guilda (para remoção de inativos)
    await GuildService.updateLastSeen(player.name);

    return player;
  }
}
