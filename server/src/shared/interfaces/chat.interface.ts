export interface ChatMessageLog {
  timestamp: string;
  playerName: string;
  playerLevel: number;
  channel: string; // 'support', 'community', 'trade', 'private'
  target?: string;
  message: string;
}

export interface ReportLog {
  timestamp: string;
  reporterName: string;
  reporterLevel: number;
  reportedName: string;
  reason: string;
  status: "pending" | "reviewed" | "dismissed";
}
