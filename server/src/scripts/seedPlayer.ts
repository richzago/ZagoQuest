/**
 * seedPlayer.ts
 *
 * Script para criar um personagem de teste com nível 100, gold, itens e equipamentos.
 * Executar com: npx ts-node src/scripts/seedPlayer.ts
 */

import "reflect-metadata";
import { AppDataSource } from "../api/data-source";
import { Character } from "../api/entities/Character";
import { Account } from "../api/entities/Account";

async function seed() {
  await AppDataSource.initialize();
  console.log("Conectado ao banco.");

  const accountRepo = AppDataSource.getRepository(Account);
  const characterRepo = AppDataSource.getRepository(Character);

  // 1. Criar ou buscar conta de teste
  let account = await accountRepo.findOne({ where: { email: "test@zagoquest.com" } });
  if (!account) {
    account = accountRepo.create({
      email: "test@zagoquest.com",
      cellphone: "+5511999999999",
      fullName: "Test Player",
      cpf: "12345678909",
      birthDate: "1990-01-01",
      passwordHash: "testhash", // em produção, use bcrypt
      address: "Test Address",
    });
    await accountRepo.save(account);
    console.log("✅ Conta de teste criada.");
  }

  // 2. Criar ou atualizar personagem
  let character = await characterRepo.findOne({ where: { name: "TestWarrior" } });
  if (!character) {
    character = characterRepo.create({
      name: "TestWarrior",
      gender: "M",
      world: "main",
      level: 100,
      xp: 0,
      hp: 100,
      maxHp: 100,
      mana: 50,
      maxMana: 50,
      gold: 100000,
      bankGold: 0,
      posX: 2,
      posY: 2,
      accountId: account.id,
      // Inventário: moedas, poções
      inventory: {
        "currency/gold_coin": 5000,
        "consumable/health_potion": 10,
        "consumable/mana_potion": 10,
      },
      // Equipamentos (IDs devem existir nos JSONs de itens)
      equipment: {
        weapon: "equipment/weapon/swords/boneSword",
        armor: "equipment/armor/boneArmor",
      },
      // Skills (níveis básicos)
      skills: {
        sword: { level: 80, progress: 0 },
        axe: { level: 1, progress: 0 },
        club: { level: 1, progress: 0 },
        distance: { level: 1, progress: 0 },
        shielding: { level: 60, progress: 0 },
        magicLevel: { level: 10, progress: 0 },
        fishing: { level: 1, progress: 0 },
      },
    });
    character.vocation = "knight";
    character.promotionStage = 0;
    // Opcional: recalcular HP e mana máximos com base na vocação e nível
    const { VocationSystem } = require("../game/systems/vocationSystem");
    character.maxHp = VocationSystem.getMaxHpBonus(character.vocation as any, character.level);
    character.maxMana = VocationSystem.getMaxManaBonus(character.vocation as any, character.level);
    character.hp = character.maxHp;
    character.mana = character.maxMana;
    await characterRepo.save(character);
    console.log("✅ Personagem TestWarrior criado (level 100, gold 100k, equipado).");
  } else {
    // Atualiza gold e inventário se já existir
    character.gold = 100000;
    character.inventory = {
      "currency/gold_coin": 5000,
      "consumable/health_potion": 10,
      "consumable/mana_potion": 10,
    };
    character.equipment = {
      weapon: "equipment/weapon/swords/boneSword",
      armor: "equipment/armor/boneArmor",
    };
    character.level = 100;
    await characterRepo.save(character);
    console.log("✅ Personagem TestWarrior atualizado.");
  }

  console.log("✅ Seed concluído.");
  await AppDataSource.destroy();
}

seed().catch(console.error);
