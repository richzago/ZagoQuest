/**
 * accountController.ts
 *
 * Controlador responsável pelas rotas de criação de contas.
 *
 * Fluxo:
 * - Recebe os dados da requisição (email, celular, nome, CPF, etc.)
 * - Chama o serviço AccountService para validar e persistir a conta.
 * - Retorna o resultado (sucesso ou erro).
 */

import { Request, Response } from "express";
import { AccountService } from "../services/accountService";

export class AccountController {
  /**
   * Cria uma nova conta no sistema.
   *
   * @param req - Objeto da requisição Express (body contém os dados da conta)
   * @param res - Objeto da resposta Express
   *
   * @returns 201 Created + dados da conta (id, email) ou 400 Bad Request com erro.
   */
  static async create(req: Request, res: Response) {
    try {
      // Delega a lógica de criação para o serviço
      const result = await AccountService.createAccount(req.body);
      res.status(201).json(result);
    } catch (err: any) {
      // Qualquer erro de validação ou duplicidade é repassado como 400
      res.status(400).json({ error: err.message });
    }
  }
}
