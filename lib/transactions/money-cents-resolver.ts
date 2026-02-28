import { fromMoneyCents, toMoneyCents } from '@/lib/utils/money-cents';

function requireCents(value: number | null, label: string): number {
  if (value === null) {
    throw new Error(`${label} is required`);
  }
  return value;
}

export function resolveRequiredMoneyCents({
  centsValue,
  label,
}: {
  centsValue: number | string | bigint | null;
  label: string;
}): number {
  const parsedCentsValue = fromMoneyCents(centsValue);
  if (parsedCentsValue !== null) {
    return requireCents(toMoneyCents(parsedCentsValue), label);
  }
  throw new Error(`${label} cents is required`);
}
