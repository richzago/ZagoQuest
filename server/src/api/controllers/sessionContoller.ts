/**
 * sessionController.ts
 *
 * Controlador responsável pela rota de autenticação (login).
 *
 * Fluxo:
 * - Recebe email e senha.
 * - Chama o serviço `SessionService.login` para validar credenciais e gerar token JWT.
 * - Retorna o token e o ID da conta.
 *
 * @module api/controllers/SessionController
 */

import { Request, Response } from "express";
import { SessionService } from "../services/sessionService";

export class SessionController {
  /**
   * Autentica um usuário e retorna um token JWT para usar nas rotas protegidas.
   *
   * @param req - Requisição contendo no corpo (body): `email` e `password`.
   * @param res - Resposta Express.
   *
   * @returns `200 OK` com `{ token, accountId }` ou `401 Unauthorized` com mensagem de erro.
   *
   * @example
   * ```json
   * // POST /api/sessions
   * // Request body:
   * {
   *   "email": "jogador@email.com",
   *   "password": "senha123"
   * }
   *
   * // Response (200):
   * {
   *   "token": "eyJhbGciOiJIUzI1NiIs...",
   *   "accountId": "550e8400-e29b-41d4-a716-446655440000"
   * }
   * ```
   */
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const result = await SessionService.login(email, password);
      res.json(result);
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  }
}
