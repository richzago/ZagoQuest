/**
 * auth.middleware.ts
 *
 * Middleware de autenticação para rotas protegidas.
 * Verifica se o cabeçalho Authorization contém um token JWT válido.
 * Se válido, decodifica o token e anexa os dados do usuário (user) à requisição (req.user).
 * Caso contrário, retorna 401 (não autorizado).
 *
 * @module api/middlewares/AuthMiddleware
 *
 * @example
 * ```typescript
 * // Uso em uma rota
 * router.get("/perfil", authMiddleware, (req, res) => {
 *   const userId = (req as any).user.id;
 *   res.json({ userId });
 * });
 * ```
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  /**
   * Extrai o token do cabeçalho Authorization.
   * Formato esperado: `Bearer <token>`
   */
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Token não fornecido" });

  const token = authHeader.split(" ")[1];

  try {
    // Verifica a assinatura e decodifica o token usando a chave secreta do .env
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    // Armazena os dados decodificados em req.user (útil para rotas que precisam do accountId)
    (req as any).user = decoded;
    next(); // Prossegue para o próximo middleware ou rota
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
};
