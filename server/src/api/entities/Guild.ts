/**
 * guild.entity.ts
 *
 * Entidade TypeORM que representa uma guilda (clã) de jogadores.
 * Armazena metadados, nível, experiência, imagens e logs.
 *
 * @module api/entities/Guild
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { GuildMember } from "./GuildMember";

/**
 * Classe que representa uma guilda.
 *
 * @remarks
 * Cada guilda tem um nome único, nível, experiência acumulada, total de kills em PvP,
 * além de imagens de perfil e capa (URLs). Os membros são armazenados na entidade `GuildMember`.
 * Os logs são armazenados como array de strings (JSONB) e mantêm apenas as 100 últimas ações.
 *
 * @example
 * ```typescript
 * // Criar uma nova guilda
 * const guild = new Guild();
 * guild.name = "Os Bravos";
 * guild.description = "Uma guilda amiga";
 * await AppDataSource.getRepository(Guild).save(guild);
 *
 * // Atualizar nível e experiência
 * guild.level = 2;
 * guild.exp = 1500;
 * await AppDataSource.getRepository(Guild).save(guild);
 * ```
 */
@Entity("guilds")
export class Guild {
  /** Identificador único da guilda (UUID). */
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** Nome da guilda (único, 3-20 caracteres, apenas letras/números). */
  @Column({ type: "varchar", length: 50, unique: true })
  name: string;

  /** Descrição da guilda (máximo 500 caracteres). */
  @Column({ type: "varchar", length: 500, default: "" })
  description: string;

  /** URL da imagem de perfil da guilda. */
  @Column({ type: "text", default: "" })
  profileImage: string;

  /** URL da imagem de capa (banner) da guilda. */
  @Column({ type: "text", default: "" })
  coverImage: string;

  /** Nível atual da guilda. */
  @Column({ type: "int", default: 1 })
  level: number;

  /** Experiência atual da guilda (usada para subir de nível). */
  @Column({ type: "int", default: 0 })
  exp: number;

  /** Total de kills em PvP acumulado pela guilda. */
  @Column({ type: "int", default: 0 })
  totalKills: number;

  /** Número de conquistas de castelo (Castle War – futuro). */
  @Column({ type: "int", nullable: true })
  castleConquests: number;

  /** Histórico de ações da guilda (máximo 100 entradas). */
  @Column({ type: "jsonb", default: [] })
  logs: string[];

  /** Data de criação da guilda. */
  @CreateDateColumn()
  createdAt: Date;

  /** Data da última atualização da guilda. */
  @UpdateDateColumn()
  updatedAt: Date;

  /** Lista de membros da guilda (relação OneToMany). */
  @OneToMany(() => GuildMember, (member) => member.guild, { cascade: true })
  members: GuildMember[];
}
