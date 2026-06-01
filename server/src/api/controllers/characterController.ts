/**
 * characterController.ts
 *
 * Controlador responsável pelas rotas de gerenciamento de personagens.
 *
 * Fluxos:
 * - Criação de personagem (POST /api/characters) – exige autenticação.
 * - Listagem de personagens de uma conta (GET /api/characters/account/:accountId) – exige autenticação.
 */

import { Request, Response } from "express";
import { CharacterService } from "../services/characterService";

export class CharacterController {
  /**
   * Cria um novo personagem associado a uma conta.
   *
   * @param req - Requisição contendo no body: accountId, name, gender, world (opcional)
   * @param res - Resposta
   *
   * @returns 201 Created com id e nome do personagem, ou 400 Bad Request.
   */
  static async create(req: Request, res: Response) {
    try {
      // Extrai os campos obrigatórios
      const { accountId, name, gender, world } = req.body;

      // Validação simples do accountId (deve ser string não vazia)
      if (!accountId || typeof accountId !== "string") {
        return res.status(400).json({ error: "accountId inválido" });
      }

      // Delega a criação ao serviço
      const result = await CharacterService.createCharacter(accountId, name, gender, world);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * Lista todos os personagens pertencentes a uma conta.
   *
   * @param req - Requisição com parâmetro `accountId` na URL (ex: /api/characters/account/123e4567...)
   * @param res - Resposta
   *
   * @returns 200 OK com array de personagens (name, gender, world, level)
   */
  static async list(req: Request, res: Response) {
    try {
      // O parâmetro pode vir como string ou array (dependendo do roteador). Garantimos string.
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
