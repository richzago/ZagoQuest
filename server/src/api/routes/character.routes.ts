/**
 * character.routes.ts
 *
 * Define as rotas para personagens.
 * Todas as rotas exigem autenticação (authMiddleware).
 * POST /api/characters -> criação de novo personagem
 * GET /api/characters/account/:accountId -> listagem de personagens da conta
 */

import { Router } from "express";
import { CharacterController } from "../controllers/characterController";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();
router.post("/", authMiddleware, CharacterController.create);
router.get("/account/:accountId", authMiddleware, CharacterController.list);
export default router;
