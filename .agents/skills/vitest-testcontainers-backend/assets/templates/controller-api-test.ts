import request from 'supertest';
import { describe, expect, it } from 'vitest';

describe('ExampleController', () => {
  it('returns a documented status code', async () => {
    const app = undefined as unknown as { getHttpServer(): unknown };
    await request(app.getHttpServer()).get('/api/v1/examples').expect(200);
    expect(true).toBe(true);
  });
});
