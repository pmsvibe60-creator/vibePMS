import { describe, expect, it } from 'vitest';
import { isValidReferenceNumber, leaseReference, referenceNumber } from '../src/lib/refnum.ts';

describe('7-3-1 reference numbers', () => {
  it('computes the check digit', () => {
    expect(referenceNumber('1234567')).toBe('12345672');
    expect(referenceNumber('1')).toBe('13');
    expect(referenceNumber(101202611)).toMatch(/^101202611\d$/);
  });
  it('validates', () => {
    expect(isValidReferenceNumber('12345672')).toBe(true);
    expect(isValidReferenceNumber('12345673')).toBe(false);
    expect(isValidReferenceNumber('1')).toBe(false);
  });
  it('builds per-lease period references', () => {
    expect(isValidReferenceNumber(leaseReference(101, 2026, 11))).toBe(true);
    expect(leaseReference(101, 2026, 11)).not.toBe(leaseReference(101, 2026, 12));
  });
  it('rejects bad input', () => {
    expect(() => referenceNumber('')).toThrow();
    expect(() => referenceNumber('1'.repeat(20))).toThrow();
  });
});
