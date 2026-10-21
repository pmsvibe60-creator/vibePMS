import { setTimeout } from 'node:timers/promises';

/** Bounded startup retry for hosts that start dependent services concurrently. */
export async function retryStartup(
  action: () => Promise<void>,
  onRetry: (attempt: number) => void,
  attempts = 12,
  delayMs = 5000,
) {
  for (let attempt = 1; ; attempt++) {
    try {
      await action();
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      onRetry(attempt);
      await setTimeout(delayMs);
    }
  }
}
