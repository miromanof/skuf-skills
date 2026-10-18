import { describe, expect, it } from 'vitest';
import { createWorkerApp } from '../src/app.js';

describe('Cloudflare Worker health boundary', () => {
  it('reports that the edge API is ready', async () => {
    const response = await createWorkerApp().request('/health');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });
});
