/**
 * guild.schema.ts
 *
 * Esquemas de validação (Zod) para guildas.
 * Define regras de negócio para criação e edição de guildas.
 *
 * @module shared/schemas/guild
 */

import { z } from "zod";

/**
 * Valida que cada palavra do nome comece com maiúscula e o restante seja minúsculo.
 * Permite apenas letras e espaços, sem números ou símbolos.
 * Exemplos válidos: "Anjos", "Demonios", "Noite Sangrenta", "Final Warning"
 * Exemplos inválidos: "AnJOs", "DemoNios", "NoitE SangRenta"
 */
const properCaseNameRegex = /^[A-Z][a-z]*(?: [A-Z][a-z]*)*$/;

/**
 * Schema para criação de uma nova guilda.
 *
 * Regras:
 * - `name`: 3 a 20 caracteres, apenas letras e espaços, cada palavra começa com maiúscula e resto minúsculo.
 * - `description`: obrigatória, máximo 500 caracteres.
 *
 * @example
 * ```typescript
 * const result = createGuildSchema.parse({ name: "Os Bravos", description: "Uma guilda amiga" });
 * ```
 */
export const createGuildSchema = z.object({
  name: z
    .string()
    .min(3, "Nome deve ter no mínimo 3 caracteres")
    .max(20, "Nome deve ter no máximo 20 caracteres")
    .regex(
      properCaseNameRegex,
      "Nome deve ter cada palavra iniciando com letra maiúscula e o restante minúsculo (ex: 'Final Warning')",
    ),
  description: z
    .string()
    .min(1, "Descrição é obrigatória")
    .max(500, "Descrição deve ter no máximo 500 caracteres"),
});

/**
 * Schema para edição da descrição da guilda (apenas líder).
 */
export const editGuildDescriptionSchema = z.object({
  description: z
    .string()
    .min(1, "Descrição é obrigatória")
    .max(500, "Descrição deve ter no máximo 500 caracteres"),
});


/** Only web-safe image URLs, max 2048 chars, without embedded credentials.
 * Non-TLS loopback images are allowed only in local development for Unity QA.
 */
export const guildImageUrlSchema = z.string().min(1).max(2048).url().refine((value) => {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.protocol === "https:") return true;
    return process.env.NODE_ENV === "development" &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}, "imageUrl deve ser HTTPS válido (HTTP localhost apenas em desenvolvimento)");
