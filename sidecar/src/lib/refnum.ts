/** Internal numeric payment reference; no country-specific bank checksum is assumed. */
export function referenceNumber(base: string | number): string {
  const value = String(base);
  if (!/^\d{1,20}$/.test(value)) throw new Error(`Invalid reference base: ${base}`);
  return value;
}

/** Stable per-lease reference: lease sequence followed by YYYYMM. */
export function leaseReference(leaseSeq: number, year: number, month: number): string {
  if (!Number.isSafeInteger(leaseSeq) || leaseSeq < 1 || !Number.isInteger(year) || year < 1000 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12)
    throw new Error('Invalid lease reference period');
  return referenceNumber(`${leaseSeq}${year}${String(month).padStart(2, '0')}`);
}
