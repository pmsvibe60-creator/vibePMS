import { describe, expect, it, vi } from 'vitest';
import { retryStartup } from '../src/lib/retry.ts';

describe('startup retries', () => {
  it('recovers when a dependency becomes available', async () => {
    const action = vi.fn().mockRejectedValueOnce(new Error('not ready')).mockResolvedValue(undefined);
    const log = vi.fn();
    await retryStartup(action, log, 3, 0);
    expect(action).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith(1);
  });

  it('fails after the retry budget so deployment does not report healthy', async () => {
    const error = new Error('invalid credentials');
    const action = vi.fn().mockRejectedValue(error);
    await expect(retryStartup(action, vi.fn(), 3, 0)).rejects.toBe(error);
    expect(action).toHaveBeenCalledTimes(3);
  });
});
