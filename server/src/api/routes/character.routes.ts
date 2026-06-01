import { Router } from "express";
import { CharacterController } from "../controllers/characterController";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();
router.post("/", authMiddleware, CharacterController.create);
router.get("/account/:accountId", authMiddleware, CharacterController.list);
export default router;
