/**
 * guildSystem.ts
 *
 * Gerencia guildas: criação, convites, membros, cargos, inatividade,
 * descrição, imagens (perfil e capa) e canal de chat.
 *
 * Regras:
 * - Máximo 100 membros
 * - Líder: level ≥100, Premium Account (futuro)
 * - Vice-líder: level ≥100, Premium Account
 * - Oficiais: até 2, level ≥50, Premium Account
 * - Membros: level ≥20, podem ser não‑premium
 * - Líder pode recrutar, remover, promover, deletar, editar descrição/imagens
 * - Vice pode recrutar, remover (exceto líder), promover (exceto líder)
 * - Oficiais podem apenas recrutar (convidar)
 * - Inatividade: líder/vice/oficial → 90 dias sem login perde o cargo; membro comum → 60 dias é expulso.
 *
 * @module game/systems/GuildSystem
 */

import { v4 as uuidv4 } from "uuid";
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { Player } from "../entities/player";
import { Logger } from "../core/logger/logger";
import { Guild, GuildMember, GuildInvite } from "../../shared/interfaces/guild.interface";

/**
 * Classe estática que contém toda a lógica de gerenciamento de guildas.
 *
 * @remarks
 * As guildas são salvas em arquivos JSON individuais dentro da pasta `data/guilds/`.
 * Cada guilda possui um líder, vice‑líder (opcional), oficiais (máx. 2) e membros.
 * As operações são registradas nos logs (canal ECONOMY para ações financeiras e SYSTEM para informações).
 *
 * @example
 * ```typescript
 * // Criar uma guilda
 * GuildSystem.createGuild(player, "Os Bravos");
 *
 * // Convidar um jogador
 * GuildSystem.inviteToGuild(player, "Amigo");
 *
 * // Aceitar convite (por quem foi convidado)
 * GuildSystem.acceptInvite(player);
 *
 * // Listar membros
 * GuildSystem.listMembers(player, 1);
 * ```
 */
export class GuildSystem {
  private static readonly GUILD_DIR = join(process.cwd(), "data", "guilds");
  private static readonly INVITES_FILE = join(process.cwd(), "data", "guilds", "invites.json");
  private static readonly INACTIVITY_LEADER_DAYS = 90;
  private static readonly INACTIVITY_MEMBER_DAYS = 60;

  // ========== Métodos auxiliares ==========
  private static ensureDir(): void {
    if (!existsSync(this.GUILD_DIR)) mkdirSync(this.GUILD_DIR, { recursive: true });
  }

  private static loadGuild(name: string): Guild | null {
    const filePath = join(this.GUILD_DIR, `${name}.json`);
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  }

  private static saveGuild(guild: Guild): void {
    this.ensureDir();
    const filePath = join(this.GUILD_DIR, `${guild.name}.json`);
    writeFileSync(filePath, JSON.stringify(guild, null, 2));
  }

  private static loadInvites(): GuildInvite[] {
    this.ensureDir();
    if (!existsSync(this.INVITES_FILE)) return [];
    const raw = readFileSync(this.INVITES_FILE, "utf-8");
    return JSON.parse(raw);
  }

  private static saveInvites(invites: GuildInvite[]): void {
    this.ensureDir();
    writeFileSync(this.INVITES_FILE, JSON.stringify(invites, null, 2));
  }

  /**
   * Retorna a guilda a que um jogador pertence (se existir).
   *
   * @param playerName - Nome do jogador
   * @returns A guilda encontrada ou `null` se o jogador não pertencer a nenhuma
   *
   * @example
   * ```typescript
   * const guild = GuildSystem.getPlayerGuild("Richard");
   * if (guild) console.log(`Você está na guilda ${guild.name}`);
   * ```
   */
  static getPlayerGuild(playerName: string): Guild | null {
    if (!existsSync(this.GUILD_DIR)) return null;
    const files = readdirSync(this.GUILD_DIR).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const raw = readFileSync(join(this.GUILD_DIR, file), "utf-8");
      const guild: Guild = JSON.parse(raw);
      if (guild.members.some((m) => m.playerName === playerName)) return guild;
    }
    return null;
  }

  /**
   * Atualiza o campo `lastSeen` de um membro da guilda (chamar no login do jogador).
   *
   * @param playerName - Nome do jogador
   * @returns {void}
   *
   * @remarks
   * Esta informação é usada pelo sistema de inatividade para expulsar membros inativos
   * ou transferir liderança.
   *
   * @example
   * ```typescript
   * // No carregamento do jogador
   * GuildSystem.updateLastSeen(player.name);
   * ```
   */
  static updateLastSeen(playerName: string): void {
    const guild = this.getPlayerGuild(playerName);
    if (!guild) return;
    const member = guild.members.find((m) => m.playerName === playerName);
    if (member) {
      member.lastSeen = new Date().toISOString();
      this.saveGuild(guild);
    }
  }

  /**
   * Processa a inatividade de todos os membros das guildas e, se necessário, transfere liderança ou remove guildas.
   * Deve ser chamado periodicamente (ex.: uma vez por dia).
   *
   * @returns {void}
   *
   * @remarks
   * Regras:
   * - Membros comuns: 60 dias sem login → expulsos.
   * - Líder: 90 dias sem login → perde cargo para o vice (se vice estiver ativo) ou para o oficial mais antigo.
   * - Vice: se inativo e líder também, é ignorado na busca.
   * - Se ninguém estiver ativo após 180 dias, a guilda é removida.
   *
   * @example
   * ```typescript
   * // Executar diariamente
   * setInterval(() => GuildSystem.processInactivity(), 24 * 60 * 60 * 1000);
   * ```
   */
  static processInactivity(): void {
    if (!existsSync(this.GUILD_DIR)) return;
    const files = readdirSync(this.GUILD_DIR).filter((f) => f.endsWith(".json"));
    const now = new Date();

    for (const file of files) {
      const raw = readFileSync(join(this.GUILD_DIR, file), "utf-8");
      const guild: Guild = JSON.parse(raw);
      let changed = false;

      // Remover membros comuns inativos
      guild.members = guild.members.filter((member) => {
        if (member.role === "member") {
          const lastSeen = new Date(member.lastSeen);
          const daysInactive = Math.floor(
            (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (daysInactive >= this.INACTIVITY_MEMBER_DAYS) {
            Logger.system(
              `Membro ${member.playerName} expulso da guilda ${guild.name} por inatividade de ${daysInactive} dias.`,
            );
            changed = true;
            return false;
          }
        }
        return true;
      });

      // Transferir liderança se líder inativo
      const leader = guild.members.find((m) => m.role === "leader");
      if (leader) {
        const lastSeenLeader = new Date(leader.lastSeen);
        const daysInactiveLeader = Math.floor(
          (now.getTime() - lastSeenLeader.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysInactiveLeader >= this.INACTIVITY_LEADER_DAYS) {
          let vice = guild.members.find((m) => m.role === "vice");
          if (vice && new Date(vice.lastSeen) > lastSeenLeader) {
            leader.role = "member";
            vice.role = "leader";
            Logger.system(
              `Liderança da guilda ${guild.name} transferida de ${leader.playerName} para ${vice.playerName} (vice) por inatividade.`,
            );
            changed = true;
          } else if (vice && new Date(vice.lastSeen) <= lastSeenLeader) {
            const officers = guild.members
              .filter((m) => m.role === "officer")
              .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
            if (officers.length > 0) {
              const newLeader = officers[0];
              leader.role = "member";
              newLeader.role = "leader";
              Logger.system(
                `Liderança da guilda ${guild.name} transferida de ${leader.playerName} para ${newLeader.playerName} (oficial) por inatividade.`,
              );
              changed = true;
            } else if (daysInactiveLeader >= this.INACTIVITY_LEADER_DAYS * 2) {
              unlinkSync(join(this.GUILD_DIR, `${guild.name}.json`));
              Logger.system(`Guilda ${guild.name} removida por inatividade total.`);
              continue;
            }
          }
        }
      }
      if (changed) this.saveGuild(guild);
    }
  }

  // ========== CRUD da guilda ==========
  /**
   * Cria uma nova guilda.
   *
   * @param player - Jogador que será o líder
   * @param guildName - Nome da guilda (3 a 20 caracteres)
   * @returns `true` se a guilda foi criada, `false` caso contrário
   *
   * @remarks
   * Requisitos:
   * - Jogador não pode pertencer a outra guilda.
   * - Nome não pode estar em uso.
   * - Nível mínimo 100.
   * - 20.000 gold são descontados do jogador.
   *
   * @example
   * ```typescript
   * const created = GuildSystem.createGuild(player, "Os Bravos");
   * if (created) console.log("Guilda criada!");
   * ```
   */
  static createGuild(player: Player, guildName: string): boolean {
    if (guildName.length < 3 || guildName.length > 20) {
      Logger.warn("Nome da guilda deve ter entre 3 e 20 caracteres.");
      return false;
    }
    if (this.getPlayerGuild(player.name)) {
      Logger.warn("Você já pertence a uma guilda.");
      return false;
    }
    if (this.loadGuild(guildName)) {
      Logger.warn("Já existe uma guilda com este nome.");
      return false;
    }
    if (player.level < 100) {
      Logger.warn("Você precisa ser nível 100 para criar uma guilda.");
      return false;
    }
    if (player.gold < 20000) {
      Logger.warn("Você precisa de 20.000 gold para criar uma guilda.");
      return false;
    }

    player.gold -= 20000;
    const newGuild: Guild = {
      id: uuidv4(),
      name: guildName,
      description: "",
      profileImage: "",
      coverImage: "",
      createdAt: new Date().toISOString(),
      members: [
        {
          playerName: player.name,
          level: player.level,
          isPremium: false, // TODO
          role: "leader",
          joinedAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
        },
      ],
    };
    this.saveGuild(newGuild);
    Logger.economy(`${player.name} criou a guilda ${guildName} por 20.000 gold.`);
    return true;
  }

  /**
   * Deleta (disband) a guilda. Apenas o líder pode executar.
   *
   * @param player - Líder da guilda
   * @returns `true` se a guilda foi removida, `false` caso contrário
   *
   * @example
   * ```typescript
   * if (GuildSystem.disbandGuild(player)) {
   *   console.log("Guilda dissolvida.");
   * }
   * ```
   */
  static disbandGuild(player: Player): boolean {
    const guild = this.getPlayerGuild(player.name);
    if (!guild) {
      Logger.warn("Você não está em uma guilda.");
      return false;
    }
    const member = guild.members.find((m) => m.playerName === player.name);
    if (member?.role !== "leader") {
      Logger.warn("Apenas o líder pode deletar a guilda.");
      return false;
    }
    const filePath = join(this.GUILD_DIR, `${guild.name}.json`);
    if (existsSync(filePath)) unlinkSync(filePath);
    Logger.economy(`${player.name} deletou a guilda ${guild.name}.`);
    return true;
  }

  /**
   * Sai da guilda (não pode ser usado pelo líder).
   *
   * @param player - Jogador que deseja sair
   * @returns `true` se conseguiu sair, `false` caso contrário
   *
   * @example
   * ```typescript
   * if (GuildSystem.leaveGuild(player)) {
   *   console.log("Você saiu da guilda.");
   * }
   * ```
   */
  static leaveGuild(player: Player): boolean {
    const guild = this.getPlayerGuild(player.name);
    if (!guild) {
      Logger.warn("Você não está em uma guilda.");
      return false;
    }
    const member = guild.members.find((m) => m.playerName === player.name);
    if (member?.role === "leader") {
      Logger.warn("O líder não pode sair da guilda. Transfira a liderança ou delete a guilda.");
      return false;
    }
    guild.members = guild.members.filter((m) => m.playerName !== player.name);
    this.saveGuild(guild);
    Logger.economy(`${player.name} saiu da guilda ${guild.name}.`);
    return true;
  }

  // ========== Edição de metadados (apenas líder) ==========
  /**
   * Define a descrição da guilda (máx. 500 caracteres).
   *
   * @param player - Líder da guilda
   * @param description - Novo texto descritivo
   * @returns `true` se a descrição foi atualizada, `false` caso contrário
   *
   * @example
   * ```typescript
   * GuildSystem.setDescription(player, "Somos os guardiões do reino!");
   * ```
   */
  static setDescription(player: Player, description: string): boolean {
    const guild = this.getPlayerGuild(player.name);
    if (!guild) {
      Logger.warn("Você não está em uma guilda.");
      return false;
    }
    const member = guild.members.find((m) => m.playerName === player.name);
    if (member?.role !== "leader") {
      Logger.warn("Apenas o líder pode alterar a descrição da guilda.");
      return false;
    }
    if (description.length > 500) {
      Logger.warn("Descrição deve ter no máximo 500 caracteres.");
      return false;
    }
    guild.description = description;
    this.saveGuild(guild);
    Logger.economy(`${player.name} alterou a descrição da guilda ${guild.name}.`);
    return true;
  }

  /**
   * Define a URL da imagem de perfil da guilda.
   *
   * @param player - Líder da guilda
   * @param imageUrl - URL da imagem
   * @returns `true` se a imagem foi atualizada, `false` caso contrário
   *
   * @example
   * ```typescript
   * GuildSystem.setProfileImage(player, "https://exemplo.com/imagem.png");
   * ```
   */
  static setProfileImage(player: Player, imageUrl: string): boolean {
    const guild = this.getPlayerGuild(player.name);
    if (!guild) {
      Logger.warn("Você não está em uma guilda.");
      return false;
    }
    const member = guild.members.find((m) => m.playerName === player.name);
    if (member?.role !== "leader") {
      Logger.warn("Apenas o líder pode alterar a imagem de perfil da guilda.");
      return false;
    }
    guild.profileImage = imageUrl;
    this.saveGuild(guild);
    Logger.economy(`${player.name} alterou a imagem de perfil da guilda ${guild.name}.`);
    return true;
  }

  /**
   * Define a URL da imagem de capa (banner) da guilda.
   *
   * @param player - Líder da guilda
   * @param imageUrl - URL da imagem
   * @returns `true` se a imagem foi atualizada, `false` caso contrário
   *
   * @example
   * ```typescript
   * GuildSystem.setCoverImage(player, "https://exemplo.com/capa.png");
   * ```
   */
  static setCoverImage(player: Player, imageUrl: string): boolean {
    const guild = this.getPlayerGuild(player.name);
    if (!guild) {
      Logger.warn("Você não está em uma guilda.");
      return false;
    }
    const member = guild.members.find((m) => m.playerName === player.name);
    if (member?.role !== "leader") {
      Logger.warn("Apenas o líder pode alterar a imagem de capa da guilda.");
      return false;
    }
    guild.coverImage = imageUrl;
    this.saveGuild(guild);
    Logger.economy(`${player.name} alterou a imagem de capa da guilda ${guild.name}.`);
    return true;
  }

  // ========== Convites ==========
  /**
   * Convida um jogador para a guilda.
   *
   * @param executor - Quem está convidando (líder, vice ou oficial)
   * @param targetName - Nome do jogador a ser convidado
   * @returns `true` se o convite foi enviado, `false` caso contrário
   *
   * @remarks
   * O convite expira em 24 horas. Não é possível convidar quem já pertence a uma guilda.
   *
   * @example
   * ```typescript
   * GuildSystem.inviteToGuild(player, "Amigo");
   * ```
   */
  static inviteToGuild(executor: Player, targetName: string): boolean {
    const guild = this.getPlayerGuild(executor.name);
    if (!guild) {
      Logger.warn("Você não está em uma guilda.");
      return false;
    }
    const member = guild.members.find((m) => m.playerName === executor.name);
    if (!member || !["leader", "vice", "officer"].includes(member.role)) {
      Logger.warn("Você não tem permissão para convidar.");
      return false;
    }
    const invites = this.loadInvites().filter((i) => new Date(i.expiresAt) > new Date());
    if (invites.some((i) => i.guildName === guild.name && i.invitedTo === targetName)) {
      Logger.warn("Já existe um convite pendente para este jogador.");
      return false;
    }
    const newInvite: GuildInvite = {
      id: uuidv4(),
      guildName: guild.name,
      invitedBy: executor.name,
      invitedTo: targetName,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    invites.push(newInvite);
    this.saveInvites(invites);
    Logger.economy(`${executor.name} convidou ${targetName} para a guilda ${guild.name}.`);
    return true;
  }

  /**
   * Aceita um convite pendente para a guilda.
   *
   * @param player - Jogador que foi convidado
   * @returns `true` se entrou na guilda, `false` caso contrário
   *
   * @remarks
   * O convite deve estar dentro do prazo de validade (24h) e o jogador não pode pertencer a outra guilda.
   *
   * @example
   * ```typescript
   * GuildSystem.acceptInvite(player);
   * ```
   */
  static acceptInvite(player: Player): boolean {
    const invites = this.loadInvites();
    const now = new Date();
    const invite = invites.find((i) => i.invitedTo === player.name && new Date(i.expiresAt) > now);
    if (!invite) {
      Logger.warn("Nenhum convite pendente encontrado para você.");
      return false;
    }
    const guild = this.loadGuild(invite.guildName);
    if (!guild) {
      Logger.warn("A guilda não existe mais.");
      this.saveInvites(invites.filter((i) => i.id !== invite.id));
      return false;
    }
    if (guild.members.length >= 100) {
      Logger.warn("A guilda atingiu o limite máximo de 100 membros.");
      return false;
    }
    if (this.getPlayerGuild(player.name)) {
      Logger.warn("Você já pertence a uma guilda.");
      return false;
    }
    if (player.level < 20) {
      Logger.warn("Você precisa ser nível 20 para entrar em uma guilda.");
      return false;
    }
    guild.members.push({
      playerName: player.name,
      level: player.level,
      isPremium: false,
      role: "member",
      joinedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    });
    this.saveGuild(guild);
    this.saveInvites(invites.filter((i) => i.id !== invite.id));
    Logger.economy(`${player.name} entrou na guilda ${guild.name}.`);
    return true;
  }

  // ========== Gestão de membros ==========
  /**
   * Remove um membro da guilda (kick). Apenas líder ou vice.
   *
   * @param executor - Quem está removendo
   * @param targetName - Nome do membro a ser removido
   * @returns `true` se o membro foi removido, `false` caso contrário
   *
   * @example
   * ```typescript
   * GuildSystem.kickFromGuild(player, "MembroRuim");
   * ```
   */
  static kickFromGuild(executor: Player, targetName: string): boolean {
    const guild = this.getPlayerGuild(executor.name);
    if (!guild) {
      Logger.warn("Você não está em uma guilda.");
      return false;
    }
    const executorMember = guild.members.find((m) => m.playerName === executor.name);
    if (!executorMember || !["leader", "vice"].includes(executorMember.role)) {
      Logger.warn("Você não tem permissão para remover membros.");
      return false;
    }
    const targetMember = guild.members.find((m) => m.playerName === targetName);
    if (!targetMember) {
      Logger.warn("Jogador não encontrado na guilda.");
      return false;
    }
    if (targetMember.role === "leader") {
      Logger.warn("Não é possível remover o líder da guilda.");
      return false;
    }
    guild.members = guild.members.filter((m) => m.playerName !== targetName);
    this.saveGuild(guild);
    Logger.economy(`${executor.name} removeu ${targetName} da guilda ${guild.name}.`);
    return true;
  }

  /**
   * Promove um membro a vice‑líder ou oficial.
   *
   * @param executor - Líder ou vice
   * @param targetName - Nome do membro a ser promovido
   * @param newRole - Novo cargo (`'vice'` ou `'officer'`)
   * @returns `true` se a promoção foi bem‑sucedida, `false` caso contrário
   *
   * @remarks
   * - Vice‑líder: apenas um por guilda, nível ≥100.
   * - Oficial: até dois, nível ≥50.
   *
   * @example
   * ```typescript
   * GuildSystem.promote(player, "Amigo", "officer");
   * ```
   */
  static promote(executor: Player, targetName: string, newRole: "vice" | "officer"): boolean {
    const guild = this.getPlayerGuild(executor.name);
    if (!guild) return false;
    const executorMember = guild.members.find((m) => m.playerName === executor.name);
    if (!executorMember || (executorMember.role !== "leader" && executorMember.role !== "vice")) {
      Logger.warn("Você não tem permissão para promover.");
      return false;
    }
    const target = guild.members.find((m) => m.playerName === targetName);
    if (!target) {
      Logger.warn("Jogador não encontrado na guilda.");
      return false;
    }
    if (newRole === "vice") {
      if (guild.members.some((m) => m.role === "vice")) {
        Logger.warn("Já existe um vice-líder na guilda.");
        return false;
      }
      if (target.level < 100) {
        Logger.warn("O vice-líder precisa ser nível 100.");
        return false;
      }
    }
    if (newRole === "officer") {
      const officerCount = guild.members.filter((m) => m.role === "officer").length;
      if (officerCount >= 2) {
        Logger.warn("Limite máximo de 2 oficiais atingido.");
        return false;
      }
      if (target.level < 50) {
        Logger.warn("O oficial precisa ser nível 50.");
        return false;
      }
    }
    target.role = newRole;
    this.saveGuild(guild);
    Logger.economy(
      `${executor.name} promoveu ${targetName} para ${newRole} na guilda ${guild.name}.`,
    );
    return true;
  }

  /**
   * Rebaixa um vice‑líder ou oficial a membro comum.
   *
   * @param executor - Líder ou vice
   * @param targetName - Nome do membro a ser rebaixado
   * @returns `true` se o rebaixamento foi bem‑sucedido, `false` caso contrário
   *
   * @example
   * ```typescript
   * GuildSystem.demote(player, "Amigo");
   * ```
   */
  static demote(executor: Player, targetName: string): boolean {
    const guild = this.getPlayerGuild(executor.name);
    if (!guild) return false;
    const executorMember = guild.members.find((m) => m.playerName === executor.name);
    if (!executorMember || (executorMember.role !== "leader" && executorMember.role !== "vice")) {
      Logger.warn("Você não tem permissão para rebaixar.");
      return false;
    }
    const target = guild.members.find((m) => m.playerName === targetName);
    if (!target) return false;
    if (target.role === "leader") {
      Logger.warn("Não é possível rebaixar o líder.");
      return false;
    }
    if (target.role === "vice") target.role = "member";
    else if (target.role === "officer") target.role = "member";
    else {
      Logger.warn("Este membro já é um membro comum.");
      return false;
    }
    this.saveGuild(guild);
    Logger.economy(`${executor.name} rebaixou ${targetName} na guilda ${guild.name}.`);
    return true;
  }

  // ========== Visualização ==========
  /**
   * Exibe informações gerais da guilda do jogador.
   *
   * @param player - Jogador (deve pertencer a uma guilda)
   * @returns {void}
   *
   * @example
   * ```typescript
   * GuildSystem.info(player);
   * ```
   */
  static info(player: Player): void {
    const guild = this.getPlayerGuild(player.name);
    if (!guild) {
      Logger.warn("Você não está em uma guilda.");
      return;
    }
    const totalMembers = guild.members.length;
    const leader = guild.members.find((m) => m.role === "leader");
    const vice = guild.members.find((m) => m.role === "vice");
    const officers = guild.members.filter((m) => m.role === "officer");
    Logger.system(`=== Guilda: ${guild.name} ===`);
    Logger.system(`ID: ${guild.id}`);
    Logger.system(`Criada em: ${new Date(guild.createdAt).toLocaleDateString()}`);
    Logger.system(`Membros: ${totalMembers}/100`);
    Logger.system(`Líder: ${leader?.playerName} (Level ${leader?.level})`);
    if (vice) Logger.system(`Vice-líder: ${vice.playerName} (Level ${vice.level})`);
    if (officers.length)
      Logger.system(`Oficiais: ${officers.map((o) => `${o.playerName} (${o.level})`).join(", ")}`);
    if (guild.description) Logger.system(`Descrição: ${guild.description}`);
    if (guild.profileImage) Logger.system(`Perfil: ${guild.profileImage}`);
    if (guild.coverImage) Logger.system(`Capa: ${guild.coverImage}`);
  }

  /**
   * Lista os membros da guilda com paginação (10 por página).
   *
   * @param player - Jogador (deve pertencer a uma guilda)
   * @param page - Número da página (padrão 1)
   * @returns {void}
   *
   * @example
   * ```typescript
   * GuildSystem.listMembers(player, 1);  // primeira página
   * GuildSystem.listMembers(player, 2);  // segunda página
   * ```
   */
  static listMembers(player: Player, page: number = 1): void {
    const guild = this.getPlayerGuild(player.name);
    if (!guild) {
      Logger.warn("Você não está em uma guilda.");
      return;
    }
    const pageSize = 10;
    const start = (page - 1) * pageSize;
    const paginated = guild.members.slice(start, start + pageSize);
    Logger.system(`=== Membros da guilda ${guild.name} (página ${page}) ===`);
    for (const m of paginated) {
      Logger.system(
        `${m.role.toUpperCase()}: ${m.playerName} (Level ${m.level}) - Último login: ${new Date(m.lastSeen).toLocaleDateString()}`,
      );
    }
    if (guild.members.length > start + pageSize) {
      Logger.system(`Digite /guild members ${page + 1} para ver mais.`);
    }
  }

  // ========== Chat da guilda ==========
  /**
   * Envia uma mensagem para o chat da guilda (canal interno).
   *
   * @param player - Jogador que envia a mensagem (deve pertencer a uma guilda)
   * @param message - Texto da mensagem
   * @returns {void}
   *
   * @remarks
   * Atualmente, apenas exibe a mensagem no console do servidor (canal SYSTEM).
   * Futuramente, com WebSocket, será enviada para todos os membros online da guilda.
   *
   * @example
   * ```typescript
   * GuildSystem.sendGuildMessage(player, "Olá pessoal!");
   * ```
   */
  static sendGuildMessage(player: Player, message: string): void {
    const guild = this.getPlayerGuild(player.name);
    if (!guild) {
      Logger.warn("Você não está em uma guilda.");
      return;
    }
    if (!message.trim()) {
      Logger.warn("Mensagem vazia.");
      return;
    }
    const formatted = `[GUILDA ${guild.name}] ${player.name}: ${message}`;
    Logger.system(formatted);
  }
}
