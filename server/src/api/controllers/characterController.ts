/**
 * characterController.ts
 *
 * Controlador responsável pelas rotas de gerenciamento de personagens.
 *
 * Fluxos:
 * - Criação de personagem (`POST /api/characters`) – exige autenticação (token JWT).
 * - Listagem de personagens de uma conta (`GET /api/characters/account/:accountId`) – exige autenticação.
 *
 * @module api/controllers/CharacterController
 */

import { Request, Response } from "express";
import { CharacterService } from "../services/characterService";

export class CharacterController {
  /**
   * Cria um novo personagem associado a uma conta.
   *
   * @param req - Requisição autenticada contendo no corpo (body):
   *              - `accountId` (UUID da conta)
   *              - `name` (nome do personagem, apenas letras/números, 3-20 caracteres)
   *              - `gender` ("M" ou "F")
   *              - `world` (string opcional, padrão "main")
   * @param res - Resposta Express.
   *
   * @returns `201 Created` com `{ id, name }` do personagem ou `400 Bad Request` com erro.
   *
   * @example
   * ```json
   * // POST /api/characters
   * // Headers: Authorization: Bearer <token>
   * // Request body:
   * {
   *   "accountId": "550e8400-e29b-41d4-a716-446655440000",
   *   "name": "Heroi",
   *   "gender": "M",
   *   "world": "main"
   * }
   *
   * // Response (201):
   * {
   *   "id": "uuid-do-personagem",
   *   "name": "Heroi"
   * }
   * ```
   */
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

  /**
   * Lista todos os personagens pertencentes a uma conta.
   *
   * @param req - Requisição autenticada com parâmetro `accountId` na URL (ex: `/api/characters/account/550e8400...`).
   * @param res - Resposta Express.
   *
   * @returns `200 OK` com um array de objetos contendo `name`, `gender`, `world`, `level`.
   *
   * @example
   * ```json
   * // GET /api/characters/account/550e8400-e29b-41d4-a716-446655440000
   * // Headers: Authorization: Bearer <token>
   *
   * // Response (200):
   * [
   *   { "name": "Heroi", "gender": "M", "world": "main", "level": 1 },
   *   { "name": "Mago", "gender": "M", "world": "main", "level": 1 }
   * ]
   * ```
   */
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
