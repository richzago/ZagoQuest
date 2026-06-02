/**
 * guild.interface.ts
 *
 * Estruturas de dados para o sistema de guildas.
 */

export interface GuildMember {
  playerName: string;
  level: number;
  isPremium: boolean;
  role: "leader" | "vice" | "officer" | "member";
  joinedAt: string; // ISO date
  lastSeen: string; // ISO date (último login)
}

export interface Guild {
  id: string;
  name: string;
  description: string; // Descrição da guilda (até 500 caracteres)
  profileImage: string; // URL ou caminho da imagem de perfil
  coverImage: string; // URL ou caminho da imagem de capa
  createdAt: string;
  members: GuildMember[];
  logs?: string[]; // (opcional) histórico de ações
}

export interface GuildInvite {
  id: string;
  guildName: string;
  invitedBy: string;
  invitedTo: string;
  expiresAt: string;
}
