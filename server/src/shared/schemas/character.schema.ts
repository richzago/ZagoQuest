/**
 * character.schema.ts
 *
 * Esquemas de validação (Zod) para criação de personagens.
 * Define as regras de negócio para:
 * - Nome do personagem: cada palavra começa com maiúscula, resto minúsculo, sem números ou símbolos.
 * - Gênero ("M" ou "F")
 * - Mundo (string opcional, padrão "main")
 *
 * @module shared/schemas/character
 */

import { z } from "zod";

/**
 * Valida que cada palavra do nome comece com maiúscula e o restante seja minúsculo.
 * Permite apenas letras e espaços, sem números ou símbolos.
 * Exemplos válidos: "Richard", "Joao Silva", "Ana Clara"
 * Exemplos inválidos: "richard", "Joao silva", "Ana123", "AnA"
 */
const properCaseNameRegex = /^[A-Z][a-z]*(?: [A-Z][a-z]*)*$/;

/**
 * Schema individual para validação do nome do personagem.
 * @remarks
 * Regras: mínimo 3, máximo 20 caracteres; cada palavra começa com maiúscula, resto minúscula; sem números ou símbolos.
 */
export const characterNameSchema = z
  .string()
  .min(3, "Nome muito curto (mínimo 3 caracteres)")
  .max(20, "Nome muito longo (máximo 20 caracteres)")
  .regex(
    properCaseNameRegex,
    "Nome deve ter cada palavra iniciando com letra maiúscula e o restante minúsculo (ex: 'Richard Zago')",
  );

/**
 * Schema completo para validação dos dados de criação de personagem.
 */
export const createCharacterSchema = z.object({
  /** Nome do personagem (validação via `characterNameSchema`) */
  name: characterNameSchema,
  /** Gênero do personagem, deve ser "M" (masculino) ou "F" (feminino) */
  gender: z.enum(["M", "F"]),
  /** Mundo onde o personagem será criado (padrão "main") */
  world: z.string().default("main"),
});
