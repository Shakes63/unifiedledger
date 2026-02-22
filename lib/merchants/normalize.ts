export function normalizeMerchantName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}
