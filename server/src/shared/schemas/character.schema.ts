/**
 * character.schema.ts
 *
 * Esquemas de validação (Zod) para criação de personagens.
 * Define as regras de negócio para:
 * - Nome do personagem (3 a 20 caracteres, apenas letras/números)
 * - Gênero ("M" ou "F")
 * - Mundo (string opcional, padrão "main")
 *
 * @module shared/schemas/character
 */

import { z } from "zod";

/**
 * Schema individual para validação do nome do personagem.
 * @remarks
 * Regras: mínimo 3, máximo 20 caracteres, apenas letras maiúsculas/minúsculas e números.
 */
export const characterNameSchema = z
  .string()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9]+$/);

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
