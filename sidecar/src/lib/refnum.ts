/**
 * Estonian payment reference number (viitenumber) using the 7-3-1 check digit.
 * Base: 1–19 digits. Result: base + check digit (2–20 digits).
 */
export function referenceNumber(base: string | number): string {
  const digits = String(base).replace(/\D/g, '');
  if (digits.length < 1 || digits.length > 19) throw new Error(`Invalid reference base: ${base}`);
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += Number(digits[digits.length - 1 - i]) * weights[i % 3];
  }
  const check = (10 - (sum % 10)) % 10;
  return digits + String(check);
}

export function isValidReferenceNumber(ref: string): boolean {
  if (!/^\d{2,20}$/.test(ref)) return false;
  return referenceNumber(ref.slice(0, -1)) === ref;
}

/** Stable per-lease reference: lease sequence + period, e.g. 12 + 202611 → 12202611X. */
export function leaseReference(leaseSeq: number, year: number, month: number): string {
  return referenceNumber(`${leaseSeq}${year}${String(month).padStart(2, '0')}`);
}
