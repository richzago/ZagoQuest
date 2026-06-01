import { z } from "zod";
import cpfValidator from "cpf-cnpj-validator";
import { differenceInYears, parseISO } from "date-fns";

const { isValid: isValidCpf } = cpfValidator.cpf;

export const createAccountSchema = z
  .object({
    email: z.string().email(),
    cellphone: z.string().regex(/^\+55\d{10,11}$/),
    fullName: z.string().min(5),
    cpf: z.string().length(11).refine(isValidCpf),
    birthDate: z.string().refine((date) => differenceInYears(new Date(), parseISO(date)) >= 16),
    password: z.string().min(6),
    confirmPassword: z.string(),
    address: z.string().min(1),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  });
