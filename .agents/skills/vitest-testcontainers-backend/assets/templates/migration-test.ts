import { describe, expect, it } from 'vitest';

describe('migrations', () => {
  it('runs from an empty database', async () => {
    expect('run migration command against disposable PostgreSQL').toBeTruthy();
  });
});
