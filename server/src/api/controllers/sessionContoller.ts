/**
 * sessionController.ts
 *
 * Controlador responsável pela rota de autenticação (login).
 *
 * Fluxo:
 * - Recebe email e senha.
 * - Chama o serviço SessionService para autenticar e gerar token JWT.
 * - Retorna token e accountId.
 */

import { Request, Response } from "express";
import { SessionService } from "../services/sessionService";

export class SessionController {
  /**
   * Autentica um usuário e retorna um token JWT.
   *
   * @param req - Requisição contendo email e password no body
   * @param res - Resposta
   *
   * @returns 200 OK com { token, accountId } ou 401 Unauthorized.
   */
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const result = await SessionService.login(email, password);
      res.json(result);
    } catch (err: any) {
      // Qualquer falha de autenticação é retornada como 401
      res.status(401).json({ error: err.message });
    }
  }
}
