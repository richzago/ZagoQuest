/**
 * guildController.ts
 *
 * Controlador responsável pelas rotas relacionadas a guildas.
 *
 * @module api/controllers/GuildController
 */

import { Request, Response } from "express";
import { GuildService } from "../services/guildService";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { parseGuildPagination } from "../pagination";

export class GuildController {

  /**
   * Authenticate the caller as the owner of a character. Guild edits also
   * verify that the URL selects the guild belonging to this character.
   */
  private static async authorizedCharacter(
    req: Request,
    res: Response,
    requireGuild: boolean,
  ): Promise<string | undefined> {
    const accountId = (req as AuthenticatedRequest).user?.id;
    if (!accountId) {
      res.status(401).json({ error: "Sessão não autenticada" });
      return;
    }
    const characterName = req.body?.characterName;
    if (typeof characterName !== "string" || !characterName.trim()) {
      res.status(400).json({ error: "characterName é obrigatório" });
      return;
    }
    if (!(await GuildService.characterBelongsToAccount(characterName, accountId))) {
      res.status(403).json({ error: "Personagem não pertence à conta" });
      return;
    }
    if (requireGuild) {
      const rawGuildName = req.params.guildName;
      const guildName = Array.isArray(rawGuildName) ? rawGuildName[0] : rawGuildName;
      const guild = await GuildService.getPlayerGuild(characterName);
      if (!guildName || !guild || guild.name !== guildName) {
        res.status(403).json({ error: "Guilda não autorizada" });
        return;
      }
    }
    return characterName;
  }
  // ========== Rankings ==========
  static async getRankByLevel(req: Request, res: Response) {
    try {
      const pagination = parseGuildPagination(req.query, 10);
      if (!pagination) {
        res.status(400).json({ error: "Paginação inválida." });
        return;
      }
      const { page, limit } = pagination;
      const { data, total } = await GuildService.getRankByLevel(page, limit);
      res.json({ page, limit, total, data });
    } catch (err: any) {
      res.status(500).json({ error: "Falha ao consultar guildas." });
    }
  }

  static async getRankByKills(req: Request, res: Response) {
    try {
      const pagination = parseGuildPagination(req.query, 10);
      if (!pagination) {
        res.status(400).json({ error: "Paginação inválida." });
        return;
      }
      const { page, limit } = pagination;
      const { data, total } = await GuildService.getRankByKills(page, limit);
      res.json({ page, limit, total, data });
    } catch (err: any) {
      res.status(500).json({ error: "Falha ao consultar guildas." });
    }
  }

  static async listAllGuilds(req: Request, res: Response) {
    try {
      const pagination = parseGuildPagination(req.query, 100);
      if (!pagination) {
        res.status(400).json({ error: "Paginação inválida." });
        return;
      }
      const { page, limit } = pagination;
      const { data, total } = await GuildService.listAllGuilds(page, limit);
      res.json({ page, limit, total, data });
    } catch (err: any) {
      res.status(500).json({ error: "Falha ao consultar guildas." });
    }
  }

  static async getGuildDetails(req: Request, res: Response) {
    try {
      let guildName = req.params.guildName;
      if (Array.isArray(guildName)) guildName = guildName[0];
      if (!guildName) return res.status(400).json({ error: "Nome da guilda não fornecido" });
      const guild = await GuildService.getGuildByName(guildName);
      if (!guild) return res.status(404).json({ error: "Guilda não encontrada" });
      const { logs, ...safeGuild } = guild;
      res.json(safeGuild);
    } catch (err: any) {
      res.status(500).json({ error: "Falha ao consultar guildas." });
    }
  }

  static async updateDescription(req: Request, res: Response): Promise<void> {
    try {
      const characterName = await GuildController.authorizedCharacter(req, res, true);
      if (!characterName) return;
      const { description } = req.body;
      if (typeof description !== "string" || !description.trim()) {
        res.status(400).json({ error: "description é obrigatória" });
        return;
      }
      await GuildService.setDescription(characterName, description);
      res.json({ message: "Descrição atualizada com sucesso" });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Falha ao atualizar guilda" });
    }
  }

  static async updateProfileImage(req: Request, res: Response): Promise<void> {
    try {
      const characterName = await GuildController.authorizedCharacter(req, res, true);
      if (!characterName) return;
      const { imageUrl } = req.body;
      if (typeof imageUrl !== "string" || !imageUrl.trim()) {
        res.status(400).json({ error: "imageUrl é obrigatória" });
        return;
      }
      await GuildService.setProfileImage(characterName, imageUrl);
      res.json({ message: "Imagem de perfil atualizada com sucesso" });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Falha ao atualizar guilda" });
    }
  }

  static async updateCoverImage(req: Request, res: Response): Promise<void> {
    try {
      const characterName = await GuildController.authorizedCharacter(req, res, true);
      if (!characterName) return;
      const { imageUrl } = req.body;
      if (typeof imageUrl !== "string" || !imageUrl.trim()) {
        res.status(400).json({ error: "imageUrl é obrigatória" });
        return;
      }
      await GuildService.setCoverImage(characterName, imageUrl);
      res.json({ message: "Imagem de capa atualizada com sucesso" });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Falha ao atualizar guilda" });
    }
  }

  static async create(req: Request, res: Response): Promise<void> {
    try {
      const characterName = await GuildController.authorizedCharacter(req, res, false);
      if (!characterName) return;
      const { guildName, description } = req.body;
      if (typeof guildName !== "string" || !guildName.trim()
          || typeof description !== "string" || !description.trim()) {
        res.status(400).json({ error: "guildName e description são obrigatórios" });
        return;
      }
      const guild = await GuildService.createGuild(characterName, guildName, description);
      res.status(201).json({ id: guild.id, name: guild.name, description: guild.description });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Falha ao criar guilda" });
    }
  }


}
