import { Request, Response } from "express";
import { AccountService } from "../services/accountService";

export class AccountController {
  static async create(req: Request, res: Response) {
    try {
      const result = await AccountService.createAccount(req.body);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
}
