/**
 * session.routes.ts
 *
 * Define a rota de login/autenticação.
 *
 * Rotas:
 * - POST /api/sessions → autentica e retorna token JWT + accountId
 *
 * @module /api/routes/SessionRoutes
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

import { Router } from "express";
import { SessionController } from "../controllers/sessionContoller";

const router = Router();

/**
 * Rota de login (pública).
 * @name POST /api/sessions
 * @function
 * @memberof module:SessionRoutes
 * @param {Object} req.body - email e password
 * @returns {Object} 200 OK com { token, accountId } ou 401 Unauthorized.
 */
router.post("/", SessionController.login);

export default router;
