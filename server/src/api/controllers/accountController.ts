/**
 * accountController.ts
 *
 * Controlador responsável pelas rotas de criação de contas.
 *
 * Fluxo:
 * - Recebe os dados da requisição (email, celular, nome completo, CPF, data de nascimento, senha, endereço).
 * - Chama o serviço `AccountService.createAccount` para validar e persistir a conta.
 * - Retorna o resultado (sucesso 201 Created ou erro 400 Bad Request).
 *
 * @module api/controllers/AccountController
 */

import { Request, Response } from "express";
import { AccountService, AccountConflictError, InvalidAccountDataError } from "../services/accountService";

export class AccountController {
  /**
   * Cria uma nova conta no sistema.
   *
   * @param req - Objeto da requisição Express. O corpo (body) deve conter os campos obrigatórios:
   *              `email`, `cellphone`, `fullName`, `cpf`, `birthDate`, `password`, `confirmPassword`, `address`.
   * @param res - Objeto da resposta Express.
   *
   * @returns `201 Created` com os dados da conta (`{ id, email }`) ou `400 Bad Request` com a mensagem de erro.
   *
   * @example
   * ```json
   * // POST /api/accounts
   * // Request body:
   * {
   *   "email": "jogador@email.com",
   *   "cellphone": "+5511999999999",
   *   "fullName": "João da Silva",
   *   "cpf": "12345678909",
   *   "birthDate": "1990-01-01",
   *   "password": "senha123",
   *   "confirmPassword": "senha123",
   *   "address": "Rua das Palmeiras, 123"
   * }
   *
   * // Response (201):
   * {
   *   "id": "550e8400-e29b-41d4-a716-446655440000",
   *   "email": "jogador@email.com"
   * }
   * ```
   */
  static async create(req: Request, res: Response) {
    try {
      const result = await AccountService.createAccount(req.body);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof InvalidAccountDataError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof AccountConflictError) {
        res.status(409).json({ error: "Dados de conta já cadastrados." });
      } else {
        // Never disclose PostgreSQL errors, constraint names or connection details.
        res.status(500).json({ error: "Falha interna ao criar conta." });
      }
    }
  }
}
