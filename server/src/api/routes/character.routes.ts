/**
 * character.routes.ts
 *
 * Define as rotas para personagens.
 * Todas as rotas exigem autenticação (authMiddleware).
 *
 * Rotas:
 * - POST /api/characters → criação de novo personagem
 * - GET /api/characters/account/:accountId → listagem de personagens da conta
 *
 * @module /api/routes/CharacterRoutes
 *
 * @example
 * ```json
 * // POST /api/characters (autenticado)
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
 *
 * @example
 * ```json
 * // GET /api/characters/account/550e8400-e29b-41d4-a716-446655440000
 * // Headers: Authorization: Bearer <token>
 *
 * // Response (200):
 * [
 *   { "name": "Heroi", "gender": "M", "world": "main", "level": 1 }
 * ]
 * ```
 */

import { Router } from "express";
import { CharacterController } from "../controllers/characterController";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

/**
 * Cria um novo personagem (requer autenticação).
 * @name POST /api/characters
 * @function
 * @memberof module:CharacterRoutes
 * @param {Object} req.body - accountId, name, gender, world (opcional)
 * @param {string} req.headers.authorization - Bearer token JWT
 * @returns {Object} 201 Created com { id, name } ou 400 Bad Request.
 */
router.post("/", authMiddleware, CharacterController.create);

/**
 * Lista todos os personagens da conta (requer autenticação).
 * @name GET /api/characters/account/:accountId
 * @function
 * @memberof module:CharacterRoutes
 * @param {string} req.params.accountId - UUID da conta
 * @param {string} req.headers.authorization - Bearer token JWT
 * @returns {Array} 200 OK com array de personagens.
 */
router.get("/account/:accountId", authMiddleware, CharacterController.list);

export default router;
