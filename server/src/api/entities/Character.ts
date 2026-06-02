/**
 * Character.ts
 *
 * Entidade TypeORM que representa um personagem de jogo (pertencente a uma conta).
 *
 * Campos:
 * - `id`: UUID gerado automaticamente.
 * - `name`: único, usado para identificar o personagem no jogo.
 * - `gender`: "M" ou "F".
 * - `world`: nome do mundo (futuro, para separar servidores).
 * - `level`: nível do personagem (progressão).
 * - `xp`: experiência total acumulada.
 * - `hp` / `maxHp`: vida atual e máxima.
 * - `mana` / `maxMana`: mana atual e máxima.
 * - `inventory`: itens no inventário (JSONB).
 * - `equipment`: equipamentos atuais (slot -> itemId).
 * - `skills`: níveis e progresso das habilidades.
 * - `gold`: dinheiro em mãos.
 * - `bankGold`: dinheiro depositado no banco.
 * - `account`: referência à conta dona (ManyToOne).
 * - `createdAt` / `updatedAt`: timestamps.
 *
 * @example
 * ```ts
 * const character = new Character();
 * character.name = "Heroi";
 * character.gender = "M";
 * character.account = account;
 * await AppDataSource.getRepository(Character).save(character);
 * ```
 *
 * @module api/entities/Character
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Account } from "./Account";

@Entity("characters")
export class Character {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: "enum", enum: ["M", "F"] })
  gender: "M" | "F";

  @Column({ default: "main" })
  world: string;

  @Column({ default: 1 })
  level: number;

  @Column({ default: 0 })
  xp: number;

  @Column({ default: 100 })
  hp: number;

  @Column({ default: 100 })
  maxHp: number;

  @Column({ default: 0 })
  mana: number;

  @Column({ default: 0 })
  maxMana: number;

  @Column({ type: "jsonb", default: {} })
  inventory: Record<string, number>;

  @Column({ type: "jsonb", default: {} })
  equipment: Record<string, string>;

  @Column({ type: "jsonb", default: {} })
  skills: Record<string, { level: number; progress: number }>;

  @Column({ default: 0 })
  gold: number;

  @Column({ default: 0 })
  bankGold: number;

  @ManyToOne(() => Account, (account) => account.characters)
  account: Account;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
