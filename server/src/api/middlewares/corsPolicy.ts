/** Browser CORS policy. No Origin = native clients (Unity), CLI or server-to-server. */
export function isCorsOriginAllowed(origin: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!origin) return true;
  // An opaque origin ('null') is not a trustworthy browser site.
  if (origin === "null") return false;
  const allowed = (env.CORS_ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  // Explicit configuration also narrows development mode.
  if (allowed.length > 0) return allowed.includes(origin);
  // Development remains convenient; production is deny-by-default for browser origins.
  return env.NODE_ENV !== "production";
}
