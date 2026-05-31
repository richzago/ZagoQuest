/**
 * Torna logs mais legíveis para humanos.
 */
export function formatLog(
  level: string,
  channel: string,
  message: string
): string {

  const time = new Date().toLocaleString("pt-BR");

  return `[${time}] [${channel.toUpperCase()}] [${level}] ${message}`;
}