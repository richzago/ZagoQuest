/**
 * guildMember.entity.ts
 *
 * Entidade TypeORM que representa um membro de uma guilda.
 * Armazena o cargo, datas de entrada e último login, além de referências à guilda e ao personagem.
 *
 * @module api/entities/GuildMember
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
import { Guild } from "./Guild";
import { Character } from "./Character";

/**
 * Classe que representa um membro de uma guilda.
 *
 * @remarks
 * Um membro tem um cargo (`role`) que pode ser `leader`, `vice`, `officer` ou `member`.
 * Os campos `joinedAt` e `lastSeen` são usados para controle de inatividade.
 * A relação com `Guild` é ManyToOne, e com `Character` é ManyToOne opcional.
 *
 * @example
 * ```typescript
 * // Adicionar um membro à guilda
 * const member = new GuildMember();
 * member.guildId = guild.id;
 * member.characterId = character.id;
 * member.characterName = character.name;
 * member.role = "member";
 * member.joinedAt = new Date();
 * member.lastSeen = new Date();
 * await AppDataSource.getRepository(GuildMember).save(member);
 * ```
 */
@Entity("guild_members")
export class GuildMember {
  /** Identificador único do membro (UUID). */
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** ID da guilda a que pertence (chave estrangeira). */
  @Column({ type: "uuid" })
  guildId: string;

  /** ID do personagem associado (chave estrangeira opcional). */
  @Column({ type: "uuid" })
  characterId: string;

  /** Nome do personagem (denormalizado para facilitar consultas). */
  @Column({ type: "varchar", length: 50 })
  characterName: string;

  /** Nível do personagem no momento da associação (atualizado periodicamente). */
  @Column({ type: "int" })
  level: number;

  /** Indica se o personagem é Premium Account. */
  @Column({ type: "boolean", default: false })
  isPremium: boolean;

  /** Cargo do membro na guilda. */
  @Column({ type: "enum", enum: ["leader", "vice", "officer", "member"], default: "member" })
  role: "leader" | "vice" | "officer" | "member";

  /** Data em que o membro entrou na guilda. */
  @Column({ type: "timestamp" })
  joinedAt: Date;

  /** Data do último login do personagem. */
  @Column({ type: "timestamp" })
  lastSeen: Date;

  /** Referência à guilda (ManyToOne). */
  @ManyToOne(() => Guild, (guild) => guild.members, { onDelete: "CASCADE" })
  @JoinColumn({ name: "guildId" })
  guild: Guild;

  /** Referência ao personagem (ManyToOne opcional). */
  @ManyToOne(() => Character, { nullable: true })
  @JoinColumn({ name: "characterId" })
  character: Character;

  /** Data de criação do registro de membro. */
  @CreateDateColumn()
  createdAt: Date;

  /** Data da última atualização do registro. */
  @UpdateDateColumn()
  updatedAt: Date;
}
