/**
 * Account.ts
 *
 * Entidade TypeORM que representa uma conta de jogador no banco de dados.
 *
 * Campos:
 * - `id`: UUID gerado automaticamente.
 * - `email`: único, usado para login.
 * - `cellphone`: número de celular (formato internacional).
 * - `fullName`: nome completo do titular.
 * - `cpf`: único, válido (11 dígitos).
 * - `birthDate`: data de nascimento (idade mínima 16 anos).
 * - `passwordHash`: hash da senha (bcrypt).
 * - `address`: endereço residencial.
 * - `characters`: lista de personagens associados (relação OneToMany).
 * - `createdAt` / `updatedAt`: timestamps automáticos.
 *
 * @example
 * ```ts
 * const account = new Account();
 * account.email = "player@example.com";
 * account.fullName = "João da Silva";
 * // ... outros campos
 * await AppDataSource.getRepository(Account).save(account);
 * ```
 *
 * @module api/entities/Account
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { Character } from "./Character";

@Entity("accounts")
export class Account {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  cellphone: string;

  @Column()
  fullName: string;

  @Column({ unique: true })
  cpf: string;

  @Column({ type: "date" })
  birthDate: string;

  @Column()
  passwordHash: string;

  @Column()
  address: string;

  @OneToMany(() => Character, (character) => character.account, { cascade: true })
  characters: Character[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
