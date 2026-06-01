import jwt from "jsonwebtoken";
import { AccountService } from "./accountService";

export class SessionService {
  static async login(email: string, password: string) {
    const account = await AccountService.authenticate(email, password);
    const token = jwt.sign({ id: account.id, email: account.email }, process.env.JWT_SECRET!, {
      expiresIn: "24h",
    });
    return { token, accountId: account.id };
  }
}
