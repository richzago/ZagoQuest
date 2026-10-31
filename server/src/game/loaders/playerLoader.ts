/**
 * playerLoader.ts
 *
 * Responsável por carregar ou criar um jogador a partir do banco de dados,
 * restaurar sua última posição salva (ou usar spawn seguro do Tiled) e atualizar guildas.
 *
 * @module game/loaders/playerLoader
 */

import { Player } from "../entities/player";
import { DatabasePersistence } from "../systems/databasePersistence";
import { GuildService } from "../../api/services/guildService";
import { Logger } from "../core/logger/logger";
import { v4 as uuidv4 } from "uuid";
import { PlayerSpawnData } from "../../shared/interfaces/spawn.interface";
import type { World } from "../world/World";
import { findSafePlayerPosition, isSafePlayerPosition } from "../world/playerPosition";

/**
 * Loader especializado para criação/carregamento do jogador.
 */
export class PlayerLoader {
  /**
   * Carrega um jogador existente na última posição válida ou cria um novo no spawn Tiled.
   *
   * @param playerName - Nome do personagem (único).
   * @param spawnPosition - Posição inicial/fallback vinda do mapa Tiled.
   * @param world - Mundo carregado para validar colisão e limites, antes de adicionar o player.
   * @returns Uma instância de Player pronta para ser adicionada ao mundo.
   *
   * @remarks
   * - Se o jogador existe, restaura posX/posY, salvando somente se o ponto ficou inválido.
   * - Se não existe, cria um novo com nível 1, HP/MP padrão, inventário vazio, usando UUID.
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
    world: World,
  ): Promise<Player> {
    // Tenta carregar do banco de dados
    let player = await DatabasePersistence.loadCharacter(playerName);

    if (!player) {
      // Cria um novo jogador com UUID
      const newPlayerId = uuidv4();
      // Jogador novo sempre começa no Tiled, nunca numa coordenada do cliente.
      const initial = findSafePlayerPosition(world, spawnPosition);
      player = new Player(newPlayerId, playerName, initial.x, initial.y);
      await DatabasePersistence.saveCharacter(player);
      Logger.system(
        `[PlayerLoader] Novo jogador ${player.name} criado com ID ${newPlayerId} e salvo no banco.`,
      );
    } else {
      // DatabasePersistence.loadCharacter já restaurou posX/posY. Não sobrescrever
      // com PlayerSpawn a cada inicialização — o spawn Tiled só é fallback.
      if (isSafePlayerPosition(world, player.position)) {
        Logger.system(
          `[PlayerLoader] ${player.name} restaurado da posição persistida (${player.position.x}, ${player.position.y}).`,
        );
      } else {
        const previous = { ...player.position };
        const safe = findSafePlayerPosition(world, spawnPosition);
        player.position = safe;
        await DatabasePersistence.saveCharacter(player);
        Logger.warn(
          `[PlayerLoader] ${player.name} com posição salva inválida (${previous.x}, ${previous.y}); recuperado no spawn Tiled (${safe.x}, ${safe.y}).`,
        );
      }
    }

    // Atualiza o timestamp da última atividade na guilda (para remoção de inativos)
    await GuildService.updateLastSeen(player.name);

    return player;
  }
}
