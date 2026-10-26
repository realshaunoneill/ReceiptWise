import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * shared/ is used by the website and by the app (mobile/), which has its own dependencies and
 * none of the web's. So nothing in it may import a package, a web module (@/…) or a Node or DOM
 * API: only other files in shared/, by relative path. Tests may also use vitest and Node.
 */

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith('.ts') ? [path] : [];
  });
}

const TEST_ONLY = new Set(['vitest', 'fs', 'path']);

describe('shared/', () => {
  it('imports only its own files', () => {
    const problems: string[] = [];
    for (const file of files(__dirname)) {
      const isTest = file.endsWith('.test.ts');
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/(?:^|\n)\s*(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)) {
        const spec = match[1];
        if (spec.startsWith('./') || spec.startsWith('../')) {
          const target = join(file, '..', spec);
          if (relative(__dirname, target).startsWith('..')) problems.push(`${relative(__dirname, file)}: ${spec} is outside shared/`);
          continue;
        }
        if (isTest && TEST_ONLY.has(spec)) continue;
        problems.push(`${relative(__dirname, file)}: ${spec}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
