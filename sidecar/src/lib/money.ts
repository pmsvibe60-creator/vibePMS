/** Twenty CURRENCY fields store amountMicros (amount × 1_000_000). */
export type Currency = { amountMicros: number | string | null; currencyCode: string | null };

export const toMicros = (amount: number) => Math.round(amount * 100) * 10_000;

export function fromMicros(c: Currency | null | undefined): number {
  if (!c || c.amountMicros === null || c.amountMicros === undefined) return 0;
  return Math.round(Number(c.amountMicros) / 10_000) / 100;
}

export const currency = (amount: number, code = 'EUR'): Currency => ({ amountMicros: toMicros(amount), currencyCode: code });

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function formatEur(n: number, locale = 'et-EE') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n);
}
