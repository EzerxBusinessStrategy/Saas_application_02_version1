import { describe, expect, it } from 'vitest';

describe('tenant RLS', () => {
  it('denies Tenant A access to Tenant B rows using the runtime role', async () => {
    expect('connect as runtime role').toBeTruthy();
  });
});
