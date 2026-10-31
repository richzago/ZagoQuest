/**
 * sessionService.ts
 *
 * Serviço responsável pela autenticação e geração de token JWT.
 * Utiliza o AccountService para verificar as credenciais e gera um token assinado.
 *
 * @module api/services/SessionService
 */

import jwt from "jsonwebtoken";
import { AccountService } from "./accountService";

export class SessionService {
  /**
   * Realiza o login: autentica o usuário e gera um token JWT.
   *
   * @param email - Email da conta
   * @param password - Senha em texto plano
   * @returns Objeto contendo token JWT e accountId
   * @throws Se a autenticação falhar (propaga o erro do AccountService)
   *
   * @example
   * ```typescript
   * const session = await SessionService.login("jogador@email.com", "senha123");
   * console.log(session.token); // "eyJhbGciOiJIUzI1NiIs..."
   * console.log(session.accountId); // "550e8400..."
   * ```
   */
  static async login(email: string, password: string) {
    // 1. Delega a autenticação ao AccountService
    const account = await AccountService.authenticate(email, password);

    // 2. Gera o token JWT com o id e email da conta
    const token = jwt.sign({ id: account.id, email: account.email }, process.env.JWT_SECRET!, {
      expiresIn: "24h",
      algorithm: "HS256",
    });

    return { token, accountId: account.id };
  }
}
