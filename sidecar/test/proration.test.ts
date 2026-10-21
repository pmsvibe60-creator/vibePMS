import { describe, expect, it } from 'vitest';
import { dueDateFor, proratedRent } from '../src/lib/dates.ts';
import { fromMicros, toMicros } from '../src/lib/money.ts';

describe('proratedRent', () => {
  it('full month', () => {
    expect(proratedRent({ monthlyRent: 900, year: 2026, month: 11, leaseStart: '2026-01-01' })).toMatchObject({ amount: 900, days: 30 });
  });
  it('mid-month start', () => {
    // 16 Nov → 30 Nov = 15 of 30 days
    expect(proratedRent({ monthlyRent: 900, year: 2026, month: 11, leaseStart: '2026-11-16' }).amount).toBe(450);
  });
  it('mid-month end', () => {
    // Feb 2027 has 28 days; ends on 14th → 14/28
    expect(proratedRent({ monthlyRent: 1000, year: 2027, month: 2, leaseStart: '2026-01-01', leaseEnd: '2027-02-14' }).amount).toBe(500);
  });
  it('no overlap', () => {
    expect(proratedRent({ monthlyRent: 900, year: 2026, month: 10, leaseStart: '2026-11-01' }).amount).toBe(0);
    expect(proratedRent({ monthlyRent: 900, year: 2027, month: 3, leaseStart: '2026-01-01', leaseEnd: '2027-02-28' }).amount).toBe(0);
  });
  it('rounds to cents', () => {
    expect(proratedRent({ monthlyRent: 777, year: 2026, month: 10, leaseStart: '2026-10-11' }).amount).toBe(526.35); // 777 × 21/31 = 526.354…
  });
  it('clamps due day to month length', () => {
    expect(dueDateFor(2027, 2, 31)).toBe('2027-02-28');
    expect(dueDateFor(2026, 11, 5)).toBe('2026-11-05');
  });
  it('micros roundtrip', () => {
    expect(fromMicros({ amountMicros: toMicros(1234.56), currencyCode: 'EUR' })).toBe(1234.56);
  });
});
