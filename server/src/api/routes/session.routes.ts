import { Router } from "express";
import { SessionController } from "../controllers/sessionContoller";

const router = Router();
router.post("/", SessionController.login);
export default router;
