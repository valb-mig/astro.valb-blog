import { Octokit } from '@octokit/rest';
import { Fault } from '@/core/error';
import type { Trigger } from '@/core/ingest/hub';

export class Dispatch implements Trigger {
  private kit: Octokit;

  constructor(
    token: string,
    private repo: string,
  ) {
    this.kit = new Octokit({ auth: token });
  }

  async run(): Promise<void> {
    const [owner, repo] = this.repo.split('/');
    try {
      await this.kit.rest.actions.createWorkflowDispatch({
        owner,
        repo,
        workflow_id: 'ingest.yml',
        ref: 'main',
        headers: { 'X-GitHub-Api-Version': '2022-11-28' },
      });
    } catch (err) {
      throw new Fault('upstream', err instanceof Error ? err.message : 'Falha ao disparar workflow');
    }
  }
}
