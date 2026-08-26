import { describe, expect, it, vi } from 'vitest';
import { withTimeout } from './supabase';

describe('withTimeout', () => {
  it('returns the operation result before the deadline', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok');
  });

  it('rejects with the configured message when an operation hangs', async () => {
    vi.useFakeTimers();
    const result = withTimeout(new Promise(() => undefined), 100, 'A operação terminou.');
    const assertion = expect(result).rejects.toThrow('A operação terminou.');
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    vi.useRealTimers();
  });
});
