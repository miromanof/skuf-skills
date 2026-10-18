import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { localEnvironmentCandidates } from '../src/local-env.js';

describe('local environment discovery', () => {
  it('finds the root .env when the API starts from either the root or its workspace', () => {
    const projectRoot = resolve('project');
    const rootEnvironment = resolve(projectRoot, '.env');

    expect(localEnvironmentCandidates(projectRoot)).toContain(rootEnvironment);
    expect(localEnvironmentCandidates(resolve(projectRoot, 'apps', 'api'))).toContain(rootEnvironment);
  });
});

