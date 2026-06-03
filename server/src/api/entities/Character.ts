/**
 * Character.ts
 *
 * Entidade TypeORM que representa um personagem de jogo dentro de uma conta.
 * Contém os dados voláteis do personagem (nível, XP, posição, inventário, equipamentos, etc.).
 *
 * @module api/entities/Character
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Account } from "./Account";

/**
 * Classe que representa um personagem jogável.
 *
 * @remarks
 * Cada personagem pertence a uma única conta. Os dados de inventário, equipamentos e skills
 * são armazenados como JSONB (objetos) para flexibilidade.
 * A posição no mundo é guardada em `posX` e `posY`.
 *
 * @example
 * ```typescript
 * // Criar um novo personagem
 * const character = new Character();
 * character.name = "Richard";
 * character.gender = "M";
 * character.account = account;
 * await AppDataSource.getRepository(Character).save(character);
 *
 * // Atualizar posição
 * character.posX = 5;
 * character.posY = 10;
 * await AppDataSource.getRepository(Character).save(character);
 * ```
 */
@Entity("characters")
export class Character {
  /** Identificador único do personagem (UUID). */
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** Nome do personagem (único, 3-20 caracteres, apenas letras/números). */
  @Column({ type: "varchar", length: 50, unique: true })
  name: string;

  /** Gênero do personagem: "M" (masculino) ou "F" (feminino). */
  @Column({ type: "enum", enum: ["M", "F"] })
  gender: "M" | "F";

  /** Mundo onde o personagem reside (futuro para separar servidores). */
  @Column({ type: "varchar", default: "main" })
  world: string;

  /** Nível do personagem (progressão). */
  @Column({ type: "int", default: 1 })
  level: number;

  /** Experiência total acumulada (XP). */
  @Column({ type: "int", default: 0 })
  xp: number;

  /** Pontos de vida atuais. */
  @Column({ type: "int", default: 100 })
  hp: number;

  /** Pontos de vida máximos. */
  @Column({ type: "int", default: 100 })
  maxHp: number;

  /** Pontos de mana atuais. */
  @Column({ type: "int", default: 0 })
  mana: number;

  /** Pontos de mana máximos. */
  @Column({ type: "int", default: 0 })
  maxMana: number;

  /** Inventário do personagem (itemId → quantidade). Armazenado como JSONB. */
  @Column({ type: "jsonb", default: {} })
  inventory: Record<string, number>;

  /** Equipamentos atuais (slot → itemId). Armazenado como JSONB. */
  @Column({ type: "jsonb", default: {} })
  equipment: Record<string, string>;

  /** Níveis e progresso das skills (SkillType → { level, progress }). */
  @Column({ type: "jsonb", default: {} })
  skills: Record<string, { level: number; progress: number }>;

  /** Dinheiro em mãos (gold). */
  @Column({ type: "int", default: 0 })
  gold: number;

  /** Dinheiro depositado no banco. */
  @Column({ type: "int", default: 0 })
  bankGold: number;

  /** Posição X no mundo (tile). */
  @Column({ type: "int", default: 2 })
  posX: number;

  /** Posição Y no mundo (tile). */
  @Column({ type: "int", default: 2 })
  posY: number;

  /** ID da conta proprietária (chave estrangeira). */
  @Column({ type: "uuid", nullable: true })
  accountId: string;

  @Column({ type: "varchar", default: "none" })
  vocation: string; // "knight", "paladin", "druid", "sorcerer"

  @Column({ type: "int", default: 0 })
  promotionStage: number; // 0 = base, 1 = elite, 2 = champion, etc.

  /** Referência à conta proprietária. */
  @ManyToOne(() => Account, (account) => account.characters, { nullable: true })
  @JoinColumn({ name: "accountId" })
  account: Account;

  /** Data de criação do personagem. */
  @CreateDateColumn()
  createdAt: Date;

  /** Data da última atualização do personagem. */
  @UpdateDateColumn()
  updatedAt: Date;
}
