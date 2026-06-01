import { Request, Response } from "express";
import { CharacterService } from "../services/characterService";

export class CharacterController {
  static async create(req: Request, res: Response) {
    try {
      const { accountId, name, gender, world } = req.body;
      if (!accountId || typeof accountId !== "string") {
        return res.status(400).json({ error: "accountId inválido" });
      }
      const result = await CharacterService.createCharacter(accountId, name, gender, world);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  static async list(req: Request, res: Response) {
    try {
      let { accountId } = req.params;
      if (Array.isArray(accountId)) accountId = accountId[0];
      if (!accountId) return res.status(400).json({ error: "accountId não fornecido" });
      const characters = await CharacterService.listCharacters(accountId);
      res.json(characters);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
}
