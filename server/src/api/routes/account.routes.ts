/**
 * account.routes.ts
 *
 * Define as rotas relacionadas a contas.
 *
 * Rotas:
 * - POST /api/accounts → criação de conta (pública)
 *
 * @module /api/routes/AccountRoutes
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

import { Router } from "express";
import { AccountController } from "../controllers/accountController";
import { registrationRateLimit } from "../middlewares/publicRateLimit";

const router = Router();

/**
 * Rota de criação de conta.
 * @name POST /api/accounts
 * @function
 * @memberof module:AccountRoutes
 * @param {Object} req.body - Dados da conta (email, cellphone, fullName, cpf, birthDate, password, confirmPassword, address)
 * @returns {Object} 201 Created com { id, email } ou 400 Bad Request com erro.
 */
router.post("/", registrationRateLimit, AccountController.create);

export default router;
