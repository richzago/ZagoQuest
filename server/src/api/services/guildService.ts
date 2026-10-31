/**
 * guildService.ts
 *
 * Serviço responsável pela lógica de negócio de guildas.
 * Utiliza TypeORM para persistência.
 *
 * @module api/services/GuildService
 */

import { AppDataSource } from "../data-source";
import { Guild } from "../entities/Guild";
import { GuildMember } from "../entities/GuildMember";
import { Character } from "../entities/Character";
import { createGuildSchema } from "../../shared/schemas/guild.schema";
import { Logger } from "../../game/core/logger/logger";
import { OnlinePlayerDirectory } from "../../game/systems/onlinePlayerDirectory";
import { withCharacterWriteLock } from "../../game/systems/characterWriteLock";
import { isValidGoldBalance } from "../../game/systems/economyRules";
import { LessThan, MoreThan } from "typeorm";

const INACTIVITY_LEADER_DAYS = 90;
const INACTIVITY_MEMBER_DAYS = 60;

export class GuildService {
  private static guildRepo = AppDataSource.getRepository(Guild);
  private static memberRepo = AppDataSource.getRepository(GuildMember);
  private static characterRepo = AppDataSource.getRepository(Character);

  /** Verify ownership against the database, never against a client-supplied name alone. */
  static async characterBelongsToAccount(characterName: string, accountId: string): Promise<boolean> {
    const character = await this.characterRepo.findOneBy({ name: characterName, accountId });
    return character !== null;
  }

  // ========== Métodos auxiliares ==========
  private static async addLog(guildId: string, action: string): Promise<void> {
    const guild = await this.guildRepo.findOne({ where: { id: guildId } });
    if (!guild) return;
    const logs = guild.logs || [];
    logs.unshift(`[${new Date().toISOString()}] ${action}`);
    if (logs.length > 100) logs.pop();
    guild.logs = logs;
    await this.guildRepo.save(guild);
  }

  /**
   * Obtém a guilda de um personagem pelo nome.
   */
  static async getPlayerGuild(characterName: string): Promise<Guild | null> {
    const member = await this.memberRepo.findOne({
      where: { characterName },
      relations: { guild: true },
    });
    return member?.guild || null;
  }

  /**
   * Atualiza o último login de um membro.
   */
  static async updateLastSeen(characterName: string): Promise<void> {
    const member = await this.memberRepo.findOne({ where: { characterName } });
    if (!member) return;
    member.lastSeen = new Date();
    await this.memberRepo.save(member);
  }

  /**
   * Processa inatividade (expulsão automática e transferência de liderança).
   */
  static async processInactivity(): Promise<void> {
    const now = new Date();
    const memberRepo = this.memberRepo;
    const guildRepo = this.guildRepo;

    // Expulsar membros comuns inativos
    const inactiveMembers = await memberRepo.find({
      where: {
        role: "member",
        lastSeen: LessThan(new Date(Date.now() - INACTIVITY_MEMBER_DAYS * 24 * 60 * 60 * 1000)),
      },
    });
    for (const member of inactiveMembers) {
      await memberRepo.remove(member);
      await this.addLog(member.guildId, `Membro ${member.characterName} expulso por inatividade.`);
      Logger.system(`Membro ${member.characterName} expulso da guilda por inatividade.`);
    }

    // Transferir liderança se líder inativo
    const inactiveLeaders = await memberRepo.find({
      where: {
        role: "leader",
        lastSeen: LessThan(new Date(Date.now() - INACTIVITY_LEADER_DAYS * 24 * 60 * 60 * 1000)),
      },
    });
    for (const leader of inactiveLeaders) {
      const guild = await guildRepo.findOne({
        where: { id: leader.guildId },
        relations: { members: true },
      });
      if (!guild) continue;

      // Procurar vice ativo
      let vice = guild.members.find((m) => m.role === "vice");
      if (vice && vice.lastSeen > leader.lastSeen) {
        leader.role = "member";
        vice.role = "leader";
        await memberRepo.save([leader, vice]);
        await this.addLog(
          guild.id,
          `Liderança transferida de ${leader.characterName} para ${vice.characterName} (vice) por inatividade.`,
        );
      } else if (vice && vice.lastSeen <= leader.lastSeen) {
        // Procurar oficial mais antigo
        const officers = guild.members
          .filter((m) => m.role === "officer")
          .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
        if (officers.length > 0) {
          const newLeader = officers[0];
          leader.role = "member";
          newLeader.role = "leader";
          await memberRepo.save([leader, newLeader]);
          await this.addLog(
            guild.id,
            `Liderança transferida de ${leader.characterName} para ${newLeader.characterName} (oficial) por inatividade.`,
          );
        } else {
          // Ninguém ativo → remover guilda
          await guildRepo.remove(guild);
          Logger.system(`Guilda ${guild.name} removida por inatividade total.`);
        }
      }
    }
  }

  // ========== CRUD ==========
  /**
   * Cria uma nova guilda.
   */
  /**
   * Creates a guild atomically: gold debit, guild row, leader row and initial log.
   * The character row lock serializes competing purchases for this character.
   */
  static async createGuild(
    characterName: string,
    guildName: string,
    description: string,
  ): Promise<Guild> {
    const validation = createGuildSchema.safeParse({ name: guildName, description });
    if (!validation.success) throw new Error(validation.error.issues[0].message);

    // Online: Player em memória é autoritativo. Offline: Character bloqueado no PG.
    const online = OnlinePlayerDirectory.findByName(characterName);
    const execute = async (): Promise<Guild> => {
      let reserved = false;
      try {
        const guild = await AppDataSource.transaction(async (manager) => {
          const characters = manager.getRepository(Character);
          const guilds = manager.getRepository(Guild);
          const members = manager.getRepository(GuildMember);

          const character = await characters.findOne({
            where: { name: characterName },
            lock: { mode: "pessimistic_write" },
          });
          if (!character) throw new Error("Personagem não encontrado.");
          if (online && online.id !== character.id)
            throw new Error("Identidade do personagem online divergente.");
          if (await members.findOne({
            where: [{ characterId: character.id }, { characterName: character.name }],
          })) throw new Error("Você já pertence a uma guilda.");
          if (await guilds.findOne({ where: { name: guildName } }))
            throw new Error("Já existe uma guilda com este nome.");

          const level = online?.level ?? character.level;
          if (level < 100) throw new Error("Nível mínimo 100 para criar guilda.");
          if (online) {
            if (!isValidGoldBalance(online.gold) || !online.reserveGold(20_000))
              throw new Error("Você precisa de 20.000 gold.");
            reserved = true;
            character.gold = online.gold; // saldo vivo, já com taxa reservada
            character.level = level;
          } else {
            if (!isValidGoldBalance(character.gold) || character.gold < 20_000)
              throw new Error("Você precisa de 20.000 gold.");
            character.gold -= 20_000;
          }
          await characters.save(character);

          const now = new Date();
          const created = await guilds.save(guilds.create({
            name: guildName,
            description,
            level: 1,
            exp: 0,
            totalKills: 0,
            logs: [`[${now.toISOString()}] Guilda criada por ${character.name}.`],
          }));
          await members.save(members.create({
            guildId: created.id,
            characterId: character.id,
            characterName: character.name,
            level,
            isPremium: false,
            role: "leader",
            joinedAt: now,
            lastSeen: now,
          }));
          return created;
        });

        // Nunca notificar ou confirmar a cobrança antes do COMMIT SQL.
        if (reserved && online) {
          online.commitReservedGold(20_000);
          try { OnlinePlayerDirectory.notifyGold(online); }
          catch (error) { Logger.warn(`[GUILD] Notificação de gold falhou: ${String(error)}`); }
        }
        Logger.economy(`${characterName} criou a guilda ${guildName} por 20.000 gold.`);
        return guild;
      } catch (error) {
        if (reserved && online) online.rollbackReservedGold(20_000);
        throw error;
      }
    };

    // Impede autosave paralelo à cobrança do mesmo personagem.
    return online ? withCharacterWriteLock(online.id, execute) : execute();
  }

  static async disbandGuild(characterName: string): Promise<void> {
    const guild = await this.getPlayerGuild(characterName);
    if (!guild) throw new Error("Você não está em uma guilda.");
    const member = await this.memberRepo.findOne({ where: { guildId: guild.id, characterName } });
    if (member?.role !== "leader") throw new Error("Apenas o líder pode deletar a guilda.");
    await this.addLog(guild.id, `Guilda dissolvida por ${characterName}.`);
    await this.guildRepo.remove(guild);
  }

  static async leaveGuild(characterName: string): Promise<void> {
    const guild = await this.getPlayerGuild(characterName);
    if (!guild) throw new Error("Você não está em uma guilda.");
    const member = await this.memberRepo.findOne({ where: { guildId: guild.id, characterName } });
    if (!member) throw new Error("Membro não encontrado.");
    if (member.role === "leader")
      throw new Error("Líder não pode sair. Transfira a liderança ou delete a guilda.");
    await this.memberRepo.remove(member); // agora member não é null
    await this.addLog(guild.id, `${characterName} saiu da guilda.`);
  }

  // ========== Edição de metadados (apenas líder) ==========
  static async setDescription(characterName: string, description: string): Promise<void> {
    const guild = await this.getPlayerGuild(characterName);
    if (!guild) throw new Error("Você não está em uma guilda.");
    const member = await this.memberRepo.findOne({ where: { guildId: guild.id, characterName } });
    if (member?.role !== "leader") throw new Error("Apenas o líder pode alterar a descrição.");
    if (description.length > 500) throw new Error("Descrição deve ter no máximo 500 caracteres.");
    const oldDesc = guild.description;
    guild.description = description;
    await this.guildRepo.save(guild);
    await this.addLog(guild.id, `Descrição alterada de "${oldDesc}" para "${description}".`);
  }

  static async setProfileImage(characterName: string, imageUrl: string): Promise<void> {
    const guild = await this.getPlayerGuild(characterName);
    if (!guild) throw new Error("Você não está em uma guilda.");
    const member = await this.memberRepo.findOne({ where: { guildId: guild.id, characterName } });
    if (member?.role !== "leader")
      throw new Error("Apenas o líder pode alterar a imagem de perfil.");
    guild.profileImage = imageUrl;
    await this.guildRepo.save(guild);
    await this.addLog(guild.id, `Imagem de perfil atualizada.`);
  }

  static async setCoverImage(characterName: string, imageUrl: string): Promise<void> {
    const guild = await this.getPlayerGuild(characterName);
    if (!guild) throw new Error("Você não está em uma guilda.");
    const member = await this.memberRepo.findOne({ where: { guildId: guild.id, characterName } });
    if (member?.role !== "leader") throw new Error("Apenas o líder pode alterar a imagem de capa.");
    guild.coverImage = imageUrl;
    await this.guildRepo.save(guild);
    await this.addLog(guild.id, `Imagem de capa atualizada.`);
  }

  // ========== Convites ==========
  // (Implementação simplificada – você pode estender com tabela de convites)
  static async inviteToGuild(executorName: string, targetName: string): Promise<void> {
    const guild = await this.getPlayerGuild(executorName);
    if (!guild) throw new Error("Executor não está em uma guilda.");
    const executor = await this.memberRepo.findOne({
      where: { guildId: guild.id, characterName: executorName },
    });
    if (!executor || !["leader", "vice", "officer"].includes(executor.role))
      throw new Error("Sem permissão para convidar.");
    // Aqui você implementaria a lógica de convite (salvar em tabela invites)
    // Por simplicidade, farei apenas o aceite posterior.
    // Vamos apenas simular: criamos um registro temporário (seria melhor uma tabela GuildInvite)
    // Por enquanto, vamos apenas logar.
    Logger.system(`Convite enviado de ${executorName} para ${targetName} na guilda ${guild.name}.`);
    // TODO: implementar tabela de convites.
  }

  static async acceptInvite(characterName: string): Promise<void> {
    // Buscar convite pendente (exemplo)
    // Por enquanto, não implementado.
    throw new Error("Aceitar convite ainda não implementado.");
  }

  // ========== Gestão de membros ==========
  static async kickFromGuild(executorName: string, targetName: string): Promise<void> {
    const guild = await this.getPlayerGuild(executorName);
    if (!guild) throw new Error("Executor não está em uma guilda.");
    const executor = await this.memberRepo.findOne({
      where: { guildId: guild.id, characterName: executorName },
    });
    if (!executor || !["leader", "vice"].includes(executor.role))
      throw new Error("Sem permissão para remover membros.");
    const target = await this.memberRepo.findOne({
      where: { guildId: guild.id, characterName: targetName },
    });
    if (!target) throw new Error("Jogador não encontrado na guilda.");
    if (target.role === "leader") throw new Error("Não é possível remover o líder.");
    await this.memberRepo.remove(target);
    await this.addLog(guild.id, `${executorName} removeu ${targetName}.`);
  }

  static async promote(
    executorName: string,
    targetName: string,
    newRole: "vice" | "officer",
  ): Promise<void> {
    const guild = await this.getPlayerGuild(executorName);
    if (!guild) throw new Error("Executor não está em uma guilda.");
    const executor = await this.memberRepo.findOne({
      where: { guildId: guild.id, characterName: executorName },
    });
    if (!executor || !["leader", "vice"].includes(executor.role))
      throw new Error("Sem permissão para promover.");
    const target = await this.memberRepo.findOne({
      where: { guildId: guild.id, characterName: targetName },
    });
    if (!target) throw new Error("Jogador não encontrado na guilda.");
    if (newRole === "vice") {
      const existingVice = await this.memberRepo.findOne({
        where: { guildId: guild.id, role: "vice" },
      });
      if (existingVice) throw new Error("Já existe um vice-líder.");
      if (target.level < 100) throw new Error("Vice-líder precisa nível 100.");
    } else if (newRole === "officer") {
      const officerCount = await this.memberRepo.count({
        where: { guildId: guild.id, role: "officer" },
      });
      if (officerCount >= 2) throw new Error("Limite máximo de 2 oficiais.");
      if (target.level < 50) throw new Error("Oficial precisa nível 50.");
    }
    const oldRole = target.role;
    target.role = newRole;
    await this.memberRepo.save(target);
    await this.addLog(
      guild.id,
      `${executorName} promoveu ${targetName} de ${oldRole} para ${newRole}.`,
    );
  }

  static async demote(executorName: string, targetName: string): Promise<void> {
    const guild = await this.getPlayerGuild(executorName);
    if (!guild) throw new Error("Executor não está em uma guilda.");
    const executor = await this.memberRepo.findOne({
      where: { guildId: guild.id, characterName: executorName },
    });
    if (!executor || !["leader", "vice"].includes(executor.role))
      throw new Error("Sem permissão para rebaixar.");
    const target = await this.memberRepo.findOne({
      where: { guildId: guild.id, characterName: targetName },
    });
    if (!target) throw new Error("Jogador não encontrado na guilda.");
    if (target.role === "leader") throw new Error("Não é possível rebaixar o líder.");
    const oldRole = target.role;
    if (target.role === "vice") target.role = "member";
    else if (target.role === "officer") target.role = "member";
    else throw new Error("Este membro já é membro comum.");
    await this.memberRepo.save(target);
    await this.addLog(
      guild.id,
      `${executorName} rebaixou ${targetName} de ${oldRole} para member.`,
    );
  }

  // ========== Visualização ==========
  static async getGuildByName(name: string): Promise<Guild | null> {
    return this.guildRepo.findOne({ where: { name } });
  }

  static async getGuildDetails(guildName: string): Promise<Guild | null> {
    return this.guildRepo.findOne({
      where: { name: guildName },
      relations: { members: true },
    });
  }

  static async getAllGuilds(limit?: number, offset?: number): Promise<Guild[]> {
    const query = this.guildRepo.createQueryBuilder("guild");
    if (limit) query.take(limit);
    if (offset) query.skip(offset);
    return query.getMany();
  }

  static async getRankByLevel(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: any[]; total: number }> {
    const [guilds, total] = await this.guildRepo.findAndCount({
      order: { level: "DESC", exp: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    const data = guilds.map((g) => ({ guildName: g.name, level: g.level, exp: g.exp }));
    return { data, total };
  }

  static async getRankByKills(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: any[]; total: number }> {
    const [guilds, total] = await this.guildRepo.findAndCount({
      order: { totalKills: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });
    const data = guilds.map((g) => ({ guildName: g.name, totalKills: g.totalKills }));
    return { data, total };
  }

  static async listAllGuilds(
    page: number = 1,
    limit: number = 100,
  ): Promise<{ data: any[]; total: number }> {
    const [guilds, total] = await this.guildRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
    });
    const data = guilds.map((g) => ({
      name: g.name,
      profileImage: g.profileImage,
      description: g.description,
    }));
    return { data, total };
  }

  static async listMembers(
    guildName: string,
    page: number = 1,
  ): Promise<{ data: any[]; total: number }> {
    const guild = await this.guildRepo.findOne({ where: { name: guildName } });
    if (!guild) throw new Error("Guilda não encontrada.");
    const [members, total] = await this.memberRepo.findAndCount({
      where: { guildId: guild.id },
      order: { role: "ASC", joinedAt: "ASC" },
      skip: (page - 1) * 10,
      take: 10,
    });
    const data = members.map((m) => ({
      characterName: m.characterName,
      level: m.level,
      role: m.role,
      lastSeen: m.lastSeen,
    }));
    return { data, total };
  }

  // ========== Chat da guilda ==========
  static async sendGuildMessage(characterName: string, message: string): Promise<void> {
    const guild = await this.getPlayerGuild(characterName);
    if (!guild) throw new Error("Você não está em uma guilda.");
    if (!message.trim()) throw new Error("Mensagem vazia.");
    const formatted = `[GUILDA ${guild.name}] ${characterName}: ${message}`;
    Logger.system(formatted);
    await this.addLog(guild.id, `Chat: ${characterName}: ${message}`);
  }
}
