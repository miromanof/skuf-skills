import { describe, expect, it } from 'vitest';
import { localEnvironmentCandidates } from '../src/local-env.js';

describe('local environment discovery', () => {
  it('finds the root .env when the API starts from either the root or its workspace', () => {
    expect(localEnvironmentCandidates('C:\\project')).toContain('C:\\project\\.env');
    expect(localEnvironmentCandidates('C:\\project\\apps\\api')).toContain('C:\\project\\.env');
  });
});
