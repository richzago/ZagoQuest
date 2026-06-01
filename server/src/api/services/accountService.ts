import { z } from "zod";
import bcrypt from "bcrypt";
import { AppDataSource } from "../data-source";
import { Account } from "../entities/Account";
import cpfValidator from "cpf-cnpj-validator";
import { differenceInYears, parseISO } from "date-fns";
import { createAccountSchema } from "../../shared/schemas/account.schema";

const { isValid: isValidCpf } = cpfValidator.cpf;

// const createAccountSchema = z
//   .object({
//     email: z.string().email(),
//     cellphone: z.string().regex(/^\+55\d{10,11}$/),
//     fullName: z.string().min(5),
//     cpf: z.string().length(11).refine(isValidCpf),
//     birthDate: z.string().refine((date) => differenceInYears(new Date(), parseISO(date)) >= 16),
//     password: z.string().min(6),
//     confirmPassword: z.string(),
//     address: z.string().min(1),
//   })
//   .refine((data) => data.password === data.confirmPassword, { message: "Senhas não conferem" });

export class AccountService {
  static async createAccount(input: any) {
    const result = createAccountSchema.safeParse(input);
    if (!result.success) {
      // Extrai todos os erros em uma string legível
      const errors = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new Error(errors);
    }
    const { email, cellphone, fullName, cpf, birthDate, password, address } = result.data;
    const accountRepo = AppDataSource.getRepository(Account);
    const existing = await accountRepo.findOneBy({ email });
    if (existing) throw new Error("Email já cadastrado");

    const passwordHash = await bcrypt.hash(password, 10);
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
    return { id: account.id, email: account.email };
  }

  static async authenticate(email: string, password: string) {
    const accountRepo = AppDataSource.getRepository(Account);
    const account = await accountRepo.findOneBy({ email });
    if (!account) throw new Error("Conta não encontrada");
    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) throw new Error("Senha incorreta");
    return account;
  }
}
