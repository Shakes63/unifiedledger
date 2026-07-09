/**
 * Parse and CLAMP pagination params (audit finding L-SEC-12: several routes did
 * `parseInt`/`parseFloat` with no clamp, so `?limit=abc` produced `.limit(NaN)`
 * — a 500 — and an unbounded limit could request the entire table).
 */
export function parsePagination(
  searchParams: URLSearchParams,
  {
    defaultLimit = 50,
    maxLimit = 500,
  }: { defaultLimit?: number; maxLimit?: number } = {}
): { limit: number; offset: number } {
  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');
  const rawLimit = Number(limitParam);
  const rawOffset = Number(offsetParam);

  // Absent/empty -> default; present-but-garbage (NaN) -> default; valid -> clamp.
  const limit =
    limitParam && limitParam.trim() !== '' && Number.isFinite(rawLimit)
      ? Math.min(maxLimit, Math.max(1, Math.floor(rawLimit)))
      : defaultLimit;
  const offset =
    offsetParam && offsetParam.trim() !== '' && Number.isFinite(rawOffset)
      ? Math.max(0, Math.floor(rawOffset))
      : 0;

  return { limit, offset };
}
