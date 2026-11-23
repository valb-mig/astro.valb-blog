import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { promisify } from 'util';
import type { Fresh, Log as Port } from '@/core/ingest/port';

const run = promisify(execFile);

const depth = '100';

const sep = '\x1f';

export class Log implements Port {
  private env: NodeJS.ProcessEnv;

  constructor(
    token: string,
    private cache: string,
  ) {
    this.env = {
      ...process.env,
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
      GIT_CONFIG_VALUE_0: `Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`,
    };
  }

  async commits(repo: string, date: string, authors?: string[]): Promise<Fresh[]> {
    const dir = await this.mirror(repo);
    const filter = authors?.length
      ? ['--fixed-strings', '--regexp-ignore-case', ...authors.map((e) => `--author=<${e}>`)]
      : [];
    const { stdout } = await run('git', [
      '--git-dir',
      dir,
      'log',
      '--all',
      `--since=${date}T00:00:00Z`,
      `--until=${date}T23:59:59Z`,
      ...filter,
      `--pretty=format:%H${sep}%s${sep}%aI${sep}%an`,
    ]);
    if (!stdout.trim()) return [];

    return stdout
      .trim()
      .split('\n')
      .map((line) => {
        const [sha, subject, at, author] = line.split(sep);
        return {
          source: 'github',
          type: 'commit' as const,
          externalId: sha,
          repo,
          url: `https://github.com/${repo}/commit/${sha}`,
          title: subject,
          payload: { message: subject, author: author ?? null },
          at,
        };
      });
  }

  private async mirror(repo: string): Promise<string> {
    const dir = `${this.cache}${repo.replace('/', '__')}.git`;
    const url = `https://github.com/${repo}.git`;
    if (existsSync(dir)) {
      await run('git', ['--git-dir', dir, 'remote', 'set-url', 'origin', url]);
      await run('git', ['--git-dir', dir, 'fetch', '--depth', depth, 'origin', '+refs/heads/*:refs/heads/*'], { env: this.env });
    } else {
      await run('git', ['clone', '--bare', '--depth', depth, url, dir], { env: this.env });
    }
    return dir;
  }
}
