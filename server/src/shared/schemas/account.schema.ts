/**
 * account.schema.ts
 *
 * Esquemas de validação (Zod) para criação de contas de usuário.
 * Define as regras de negócio para:
 * - Email (formato válido)
 * - Telefone celular (padrão +55DDDNÚMERO)
 * - Nome completo (mínimo 5 caracteres)
 * - CPF (válido e com 11 dígitos)
 * - Data de nascimento (idade mínima 16 anos)
 * - Senha (mínimo 6 caracteres)
 * - Confirmação de senha (deve ser idêntica)
 * - Endereço (campo obrigatório)
 *
 * @module shared/schemas/account
 */

import { z } from "zod";
import cpfValidator from "cpf-cnpj-validator";
import { differenceInYears, parseISO } from "date-fns";

const { isValid: isValidCpf } = cpfValidator.cpf;

/**
 * Schema para validação de dados de criação de conta.
 */
export const createAccountSchema = z
  .object({
    /** Email do usuário (formato válido, ex: usuario@exemplo.com) */
    email: z.string().email(),
    /** Número de celular no formato internacional +55DDDNÚMERO (ex: +5511999999999) */
    cellphone: z.string().regex(/^\+55\d{10,11}$/),
    /** Nome completo (mínimo 5 caracteres) */
    fullName: z.string().min(5),
    /** CPF com 11 dígitos e dígitos verificadores válidos */
    cpf: z.string().length(11).refine(isValidCpf),
    /** Data de nascimento no formato YYYY-MM-DD (idade mínima 16 anos) */
    birthDate: z.string().refine((date) => differenceInYears(new Date(), parseISO(date)) >= 16),
    /** Senha (mínimo 6 caracteres) */
    password: z.string().min(6),
    /** Confirmação da senha (deve ser igual ao campo `password`) */
    confirmPassword: z.string(),
    /** Endereço (campo obrigatório) */
    address: z.string().min(1),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Senhas não conferem",
    path: ["confirmPassword"],
  });
