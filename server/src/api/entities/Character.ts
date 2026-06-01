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
