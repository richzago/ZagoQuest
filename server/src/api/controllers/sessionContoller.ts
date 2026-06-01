import { Request, Response } from "express";
import { SessionService } from "../services/sessionService";

export class SessionController {
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const result = await SessionService.login(email, password);
      res.json(result);
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  }
}
