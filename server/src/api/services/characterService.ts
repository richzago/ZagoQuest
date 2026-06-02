/**
 * characterService.ts
 *
 * Serviço responsável pela lógica de negócio de personagens:
 * - Criação de novos personagens (associados a uma conta)
 * - Listagem de personagens de uma conta
 *
 * @module api/services/CharacterService
 */

import { AppDataSource } from "../data-source";
import { Character } from "../entities/Character";
import { Account } from "../entities/Account";
import { createCharacterSchema } from "../../shared/schemas/character.schema";

export class CharacterService {
  /**
   * Cria um novo personagem para uma conta.
   *
   * @param accountId - UUID da conta dona do personagem
   * @param name - Nome do personagem (validado pelo schema)
   * @param gender - 'M' ou 'F'
   * @param world - Nome do mundo (padrão 'main')
   * @returns Objeto com id e nome do personagem criado
   * @throws Se validação falhar, nome já existir, ou conta não encontrada
   *
   * @example
   * ```typescript
   * const result = await CharacterService.createCharacter(
   *   "550e8400-e29b-41d4-a716-446655440000",
   *   "Heroi",
   *   "M",
   *   "main"
   * );
   * console.log(result); // { id: "uuid", name: "Heroi" }
   * ```
   */
  static async createCharacter(
    accountId: string,
    name: string,
    gender: "M" | "F",
    world: string = "main",
  ) {
    // 1. Valida os dados com o schema Zod (apenas nome, gênero e mundo)
    const validation = createCharacterSchema.safeParse({ name, gender, world });
    if (!validation.success) throw new Error(validation.error.issues[0].message);

    const characterRepo = AppDataSource.getRepository(Character);

    // 2. Verifica se já existe personagem com o mesmo nome
    const existing = await characterRepo.findOneBy({ name });
    if (existing) throw new Error("Personagem já existe");

    // 3. Busca a conta para associar o personagem
    const accountRepo = AppDataSource.getRepository(Account);
    const account = await accountRepo.findOneBy({ id: accountId });
    if (!account) throw new Error("Conta não encontrada");

    // 4. Cria a entidade Character com valores iniciais padrão
    const character = characterRepo.create({
      name,
      gender,
      world,
      account,
      level: 1,
      xp: 0,
      hp: 100,
      maxHp: 100,
      mana: 0,
      maxMana: 0,
      inventory: {},
      equipment: {},
      skills: {},
      gold: 0,
      bankGold: 0,
    });
    await characterRepo.save(character);

    return { id: character.id, name: character.name };
  }

  /**
   * Lista todos os personagens de uma conta.
   *
   * @param accountId - UUID da conta
   * @returns Array com objetos contendo name, gender, world, level
   *
   * @example
   * ```typescript
   * const characters = await CharacterService.listCharacters("550e8400...");
   * console.log(characters);
   * // [
   * //   { name: "Heroi", gender: "M", world: "main", level: 1 },
   * //   { name: "Mago", gender: "M", world: "main", level: 5 }
   * // ]
   * ```
   */
  static async listCharacters(accountId: string) {
    const characterRepo = AppDataSource.getRepository(Character);
    return await characterRepo.find({
      where: { account: { id: accountId } },
      select: {
        name: true,
        gender: true,
        world: true,
        level: true,
      },
    });
  }
}
