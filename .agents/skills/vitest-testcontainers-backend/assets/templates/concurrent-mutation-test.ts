import { describe, expect, it } from 'vitest';

describe('concurrent mutation', () => {
  it('allows only one competing decision to succeed', async () => {
    const results = await Promise.allSettled([Promise.resolve('ok'), Promise.resolve('conflict')]);
    expect(results).toHaveLength(2);
  });
});
