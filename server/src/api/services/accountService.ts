/**
 * accountService.ts
 *
 * Serviço responsável pela lógica de negócio relacionada a contas:
 * - Criação de conta com validação (Zod)
 * - Hash de senha (bcrypt)
 * - Autenticação (verificação de credenciais)
 */

import bcrypt from "bcrypt";
import { AppDataSource } from "../data-source";
import { Account } from "../entities/Account";
import { createAccountSchema } from "../../shared/schemas/account.schema";

export class AccountService {
  /**
   * Cria uma nova conta.
   * @param input Dados brutos da requisição (email, cellphone, fullName, cpf, birthDate, password, confirmPassword, address)
   * @returns Objeto com id e email da conta criada
   * @throws Se a validação falhar, email duplicado, ou dados inválidos
   */
  static async createAccount(input: any) {
    // 1. Valida os dados com o schema Zod
    const result = createAccountSchema.safeParse(input);
    if (!result.success) {
      // Converte os erros do Zod em uma string legível
      const errors = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new Error(errors);
    }

    // 2. Extrai os dados já validados
    const { email, cellphone, fullName, cpf, birthDate, password, address } = result.data;
    const accountRepo = AppDataSource.getRepository(Account);

    // 3. Verifica se o email já está cadastrado
    const existing = await accountRepo.findOneBy({ email });
    if (existing) throw new Error("Email já cadastrado");

    // 4. Gera o hash da senha (bcrypt, custo 10)
    const passwordHash = await bcrypt.hash(password, 10);

    // 5. Cria a entidade e salva no banco
    const account = accountRepo.create({
      email,
      cellphone,
      fullName,
      cpf,
      birthDate,
      passwordHash,
      address,
    });
    await accountRepo.save(account);

    // 6. Retorna apenas o id e email (não expõe dados sensíveis)
    return { id: account.id, email: account.email };
  }

  /**
   * Autentica um usuário (verifica email e senha).
   * @param email Email da conta
   * @param password Senha em texto plano
   * @returns A entidade Account se a autenticação for bem‑sucedida
   * @throws Se a conta não existir ou a senha estiver incorreta
   */
  static async authenticate(email: string, password: string) {
    const accountRepo = AppDataSource.getRepository(Account);
    const account = await accountRepo.findOneBy({ email });
    if (!account) throw new Error("Conta não encontrada");

    // Compara a senha fornecida com o hash armazenado
    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) throw new Error("Senha incorreta");

    return account;
  }
}
