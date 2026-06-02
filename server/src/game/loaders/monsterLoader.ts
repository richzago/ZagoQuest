/**
 * loadMonster.ts
 *
 * Carregador simples de monstros a partir de arquivos JSON.
 * Lê um arquivo contendo os dados de um monstro (segundo a interface `MonsterType`).
 *
 * @module game/loaders/loadMonster
 */

import fs from "fs";
import path from "path";

/**
 * Carrega os dados de um monstro a partir de um arquivo JSON.
 *
 * @param filePath - Caminho relativo ao diretório `src/data/monsters/` (ex: "animals/lowlevel/rat.json")
 * @returns O objeto JavaScript correspondente ao JSON do monstro
 *
 * @remarks
 * A função constrói o caminho absoluto a partir do diretório atual do script (`__dirname` + "/..").
 * O arquivo é lido de forma síncrona e o JSON é parseado.
 * Se o arquivo não existir ou o JSON for inválido, uma exceção será lançada.
 *
 * @example
 * ```typescript
 * const ratData = loadMonster("animals/lowlevel/rat.json");
 * console.log(ratData.name); // "Rat"
 * ```
 */
export function loadMonster(filePath: string) {
  const fullPath = path.join(__dirname, "..", filePath);
  const data = fs.readFileSync(fullPath, "utf-8");
  return JSON.parse(data);
}
