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
