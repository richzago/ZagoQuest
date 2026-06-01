/**
 * account.routes.ts
 *
 * Define as rotas relacionadas a contas.
 * POST /api/accounts -> criação de conta
 */

import { Router } from "express";
import { AccountController } from "../controllers/accountController";

const router = Router();
router.post("/", AccountController.create);
export default router;
