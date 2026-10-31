/**
 * accountService.ts
 *
 * Serviço responsável pela lógica de negócio relacionada a contas:
 * - Criação de conta com validação (Zod)
 * - Hash de senha (bcrypt)
 * - Autenticação (verificação de credenciais)
 *
 * @module api/services/AccountService
 */

import bcrypt from "bcrypt";
import { AppDataSource } from "../data-source";
import { Account } from "../entities/Account";
import { createAccountSchema } from "../../shared/schemas/account.schema";

/** Safe public authentication failure; never reveal which credential is wrong. */
export class InvalidCredentialsError extends Error {
  constructor() {
    super("Credenciais inválidas.");
    this.name = "InvalidCredentialsError";
  }
}

export class AccountService {
  /**
   * Cria uma nova conta.
   *
   * @param input - Dados brutos da requisição (email, cellphone, fullName, cpf, birthDate, password, confirmPassword, address)
   * @returns Objeto com id e email da conta criada
   * @throws Se a validação falhar, email duplicado, ou dados inválidos
   *
   * @example
   * ```typescript
   * const result = await AccountService.createAccount({
   *   email: "jogador@email.com",
   *   cellphone: "+5511999999999",
   *   fullName: "João da Silva",
   *   cpf: "12345678909",
   *   birthDate: "1990-01-01",
   *   password: "senha123",
   *   confirmPassword: "senha123",
   *   address: "Rua Exemplo, 123"
   * });
   * console.log(result); // { id: "uuid", email: "jogador@email.com" }
   * ```
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
   *
   * @param email - Email da conta
   * @param password - Senha em texto plano
   * @returns A entidade Account se a autenticação for bem‑sucedida
   * @throws Se a conta não existir ou a senha estiver incorreta
   *
   * @example
   * ```typescript
   * const account = await AccountService.authenticate("jogador@email.com", "senha123");
   * console.log(account.id); // "uuid"
   * ```
   */
  static async authenticate(email: string, password: string) {
    const accountRepo = AppDataSource.getRepository(Account);
    const account = await accountRepo.findOneBy({ email });
    if (!account) throw new InvalidCredentialsError();

    // Compara a senha fornecida com o hash armazenado
    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) throw new InvalidCredentialsError();

    return account;
  }
}
