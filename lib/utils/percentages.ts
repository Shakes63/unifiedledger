/**
 * Largest-remainder percentage allocation (L-RPT-13).
 *
 * Rounding each share of a distribution independently makes the displayed
 * numbers disagree with the whole: 1/3+1/3+1/3 at one decimal shows
 * 33.3+33.3+33.3 = 99.9, and a 33.35/66.65 split shows 33.3+66.6 = 99.9.
 * In a finance app "percentages that don't add up" reads as a data bug.
 *
 * This rounds every share DOWN to the requested precision, then hands the
 * leftover quanta (0.1s at one decimal) to the shares with the largest
 * remainders until the total is exactly 100.
 */
export function allocatePercentages(values: number[], decimals = 1): number[] {
  if (values.length === 0) return [];

  const total = values.reduce((sum, v) => sum + Math.abs(v), 0);
  if (!Number.isFinite(total) || total <= 0) return values.map(() => 0);

  const scale = 10 ** decimals;
  // Work in integer quanta (e.g. tenths of a percent) to avoid float drift.
  const exact = values.map((v) => (Math.abs(v) / total) * 100 * scale);
  const floors = exact.map(Math.floor);
  let leftover = 100 * scale - floors.reduce((sum, f) => sum + f, 0);

  // Give one quantum each to the largest remainders (stable on ties: first wins).
  const order = exact
    .map((e, i) => ({ remainder: e - floors[i], i }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (const { i } of order) {
    if (leftover <= 0) break;
    floors[i] += 1;
    leftover -= 1;
  }

  return floors.map((f) => f / scale);
}
