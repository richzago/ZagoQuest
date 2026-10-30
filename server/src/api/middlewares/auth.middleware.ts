/** Authenticate HTTP requests and expose the verified account identity. */
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type AuthenticatedRequest = Request & {
  user?: { id: string; email?: string };
};

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const match = /^Bearer (\S+)$/i.exec(req.headers.authorization ?? "");
  if (!match) {
    res.status(401).json({ error: "Token não fornecido ou malformado" });
    return;
  }

  try {
    const payload = jwt.verify(match[1], process.env.JWT_SECRET!);
    // A valid signature is insufficient if the account identity is absent.
    if (typeof payload === "string" || typeof payload.id !== "string" || !payload.id.trim()) {
      throw new Error("Token sem identidade de conta");
    }
    (req as AuthenticatedRequest).user = {
      id: payload.id,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}
