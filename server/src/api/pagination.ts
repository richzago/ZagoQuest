/** Strict, bounded pagination for public Guild REST endpoints. */
export type GuildPagination = { page: number; limit: number };

function integerParam(value: unknown, fallback: number, max: number): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^[1-9][0-9]{0,5}$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number <= max ? number : null;
}

/** Page is 1..10000, limit 1..100; reject arrays, negative, floats and partial parseInt. */
export function parseGuildPagination(
  query: { page?: unknown; limit?: unknown },
  defaultLimit: number,
): GuildPagination | null {
  const page = integerParam(query.page, 1, 10_000);
  const limit = integerParam(query.limit, defaultLimit, 100);
  return page === null || limit === null ? null : { page, limit };
}
