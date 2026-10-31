/**
 * Defesa em profundidade: não encaminhar credenciais comuns para console/disco.
 * Não substitui a regra principal de nunca interpolar senhas/JWTs em logs.
 */
export function redactLogMessage(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/[^/\s@]+@/gi, "postgresql://[REDACTED]@")
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED JWT]")
    .replace(/\b(password|passwd|jwt_secret|client_secret|secret|access_token|refresh_token|authorization|api[_-]?key|token)\b(["']?\s*[:=]\s*["']?)([^"'\s,&}]+)/gi,
      (_match, field: string, separator: string) => field + separator + "[REDACTED]");
}
