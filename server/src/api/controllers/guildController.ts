/**
 * guildController.ts
 *
 * Controlador responsável pelas rotas relacionadas a guildas.
 *
 * @module api/controllers/GuildController
 */

import { Request, Response } from "express";
import { GuildService } from "../services/guildService";

export class GuildController {
  // ========== Rankings ==========
  static async getRankByLevel(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const { data, total } = await GuildService.getRankByLevel(page, limit);
      res.json({ page, limit, total, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async getRankByKills(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const { data, total } = await GuildService.getRankByKills(page, limit);
      res.json({ page, limit, total, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async listAllGuilds(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const { data, total } = await GuildService.listAllGuilds(page, limit);
      res.json({ page, limit, total, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
      res.status(500).json({ error: err.message });
    }
  }

  static async updateDescription(req: Request, res: Response) {
    try {
      const guildName = req.params.guildName;
      const { characterName, description } = req.body;
      if (!characterName || !description)
        return res.status(400).json({ error: "characterName e description são obrigatórios" });
      await GuildService.setDescription(characterName, description);
      res.json({ message: "Descrição atualizada com sucesso" });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  static async updateProfileImage(req: Request, res: Response) {
    try {
      const guildName = req.params.guildName;
      const { characterName, imageUrl } = req.body;
      if (!characterName || !imageUrl)
        return res.status(400).json({ error: "characterName e imageUrl são obrigatórios" });
      await GuildService.setProfileImage(characterName, imageUrl);
      res.json({ message: "Imagem de perfil atualizada com sucesso" });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  static async updateCoverImage(req: Request, res: Response) {
    try {
      const guildName = req.params.guildName;
      const { characterName, imageUrl } = req.body;
      if (!characterName || !imageUrl)
        return res.status(400).json({ error: "characterName e imageUrl são obrigatórios" });
      await GuildService.setCoverImage(characterName, imageUrl);
      res.json({ message: "Imagem de capa atualizada com sucesso" });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
}
