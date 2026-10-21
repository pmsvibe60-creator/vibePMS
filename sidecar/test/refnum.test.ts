import { describe, expect, it } from 'vitest';
import { leaseReference, referenceNumber } from '../src/lib/refnum.ts';

describe('payment references', () => {
  it('preserves an internal numeric reference without a bank-specific checksum', () => {
    expect(referenceNumber('001234567')).toBe('001234567');
    expect(referenceNumber(101202611)).toBe('101202611');
  });
  it('builds distinct per-lease period references', () => {
    expect(leaseReference(101, 2026, 11)).toBe('101202611');
    expect(leaseReference(101, 2026, 11)).not.toBe(leaseReference(101, 2026, 12));
    expect(leaseReference(102, 2026, 11)).not.toBe(leaseReference(101, 2026, 11));
  });
  it('rejects bad input without silently dropping characters', () => {
    for (const value of ['', '12x34', '1'.repeat(21)]) expect(() => referenceNumber(value)).toThrow();
    expect(() => leaseReference(101, 2026, 13)).toThrow();
  });
});
