import { z } from "zod";
import { AppDataSource } from "../data-source";
import { Character } from "../entities/Character";
import { Account } from "../entities/Account";
import { createCharacterSchema } from "../../shared/schemas/character.schema";

// const characterNameSchema = z
//   .string()
//   .min(3)
//   .max(20)
//   .regex(/^[a-zA-Z0-9]+$/);

export class CharacterService {
  static async createCharacter(
    accountId: string,
    name: string,
    gender: "M" | "F",
    world: string = "main",
  ) {
    const validation = createCharacterSchema.safeParse({ name, gender, world });
    if (!validation.success) throw new Error(validation.error.issues[0].message);

    const characterRepo = AppDataSource.getRepository(Character);
    const existing = await characterRepo.findOneBy({ name });
    if (existing) throw new Error("Personagem já existe");

    const accountRepo = AppDataSource.getRepository(Account);
    const account = await accountRepo.findOneBy({ id: accountId });
    if (!account) throw new Error("Conta não encontrada");

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
