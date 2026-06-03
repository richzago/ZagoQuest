/**
 * validation.helper.ts
 *
 * Funções auxiliares para validações comuns (case‑insensitive, unicidade de nomes, etc.)
 *
 * @module shared/schemas/validation.helper
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { Guild } from "../interfaces/guild.interface";

/**
 * Normaliza uma string para comparação case‑insensitive.
 * @param str - String a ser normalizada
 * @returns String em minúsculas
 */
export function normalizeString(str: string): string {
  return str.toLowerCase();
}

/**
 * Verifica se um nome de guilda já existe no diretório de guildas (case‑insensitive).
 * @param guildName - Nome da guilda a verificar
 * @param guildDir - Diretório onde estão os arquivos JSON das guildas
 * @returns `true` se o nome já estiver em uso, `false` caso contrário
 */
export function isGuildNameTaken(guildName: string, guildDir: string): boolean {
  const normalizedInput = normalizeString(guildName);
  if (!existsSync(guildDir)) return false;
  const files = readdirSync(guildDir).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const raw = readFileSync(join(guildDir, file), "utf-8");
    const guild: Guild = JSON.parse(raw);
    if (normalizeString(guild.name) === normalizedInput) return true;
  }
  return false;
}
