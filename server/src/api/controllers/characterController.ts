/**
 * Character endpoints: the account always comes from the signed JWT.
 * Never trust accountId supplied by clients as proof of ownership.
 */
import type { Request, Response } from "express";
import { CharacterService } from "../services/characterService";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware";

export class CharacterController {
  static async create(req: Request, res: Response): Promise<void> {
    const accountId = (req as AuthenticatedRequest).user?.id;
    if (!accountId) {
      res.status(401).json({ error: "Sessão não autenticada" });
      return;
    }
    // Keep accepting the legacy accountId field, but never let it override JWT.
    if (req.body?.accountId !== undefined && req.body.accountId !== accountId) {
      res.status(403).json({ error: "Conta não autorizada" });
      return;
    }

    try {
      const { name, gender, world } = req.body ?? {};
      const character = await CharacterService.createCharacter(accountId, name, gender, world);
      res.status(201).json(character);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Dados inválidos" });
    }
  }

  static async list(req: Request, res: Response): Promise<void> {
    const accountId = (req as AuthenticatedRequest).user?.id;
    if (!accountId) {
      res.status(401).json({ error: "Sessão não autenticada" });
      return;
    }
    const pathId = req.params.accountId;
    const requestedId = Array.isArray(pathId) ? pathId[0] : pathId;
    if (!requestedId) {
      res.status(400).json({ error: "accountId não fornecido" });
      return;
    }
    if (requestedId !== accountId) {
      res.status(403).json({ error: "Conta não autorizada" });
      return;
    }

    try {
      res.json(await CharacterService.listCharacters(accountId));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao listar personagens" });
    }
  }
}
