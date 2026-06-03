/**
 * guild.routes.ts
 *
 * Rotas relacionadas a guildas.
 *
 * @module api/routes/guildRoutes
 */

import { Router } from "express";
import { GuildController } from "../controllers/guildController";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// Rotas públicas (listagens)
router.get("/rank/level", GuildController.getRankByLevel);
router.get("/rank/kills", GuildController.getRankByKills);
router.get("/list", GuildController.listAllGuilds);
router.get("/:guildName", GuildController.getGuildDetails);

// Rotas protegidas (apenas líder)
router.put("/:guildName/description", authMiddleware, GuildController.updateDescription);
router.put("/:guildName/profile-image", authMiddleware, GuildController.updateProfileImage);
router.put("/:guildName/cover-image", authMiddleware, GuildController.updateCoverImage);

// Rota protegida para criar guilda (qualquer jogador autenticado que atenda aos requisitos)
router.post("/", authMiddleware, GuildController.create);
    
export default router;
