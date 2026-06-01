import { Router } from "express";
import { AccountController } from "../controllers/accountController";

const router = Router();
router.post("/", AccountController.create);
export default router;
