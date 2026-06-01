/**
 * session.routes.ts
 *
 * Define a rota de login/autenticação.
 * POST /api/sessions -> autentica e retorna token JWT + accountId
 */

import { Router } from "express";
import { SessionController } from "../controllers/sessionContoller";

const router = Router();
router.post("/", SessionController.login);
export default router;
