import type { Service as Posts } from './post/service';
import type { Service as Projects } from './project/service';
import type { Service as Reactions } from './reaction/service';
import type { Runs } from './run/port';
import type { Run } from './run/run';

export type Stats = {
  posts: number;
  projects: number;
  reactions: number;
  runs: Run[];
};

export class Service {
  constructor(
    private posts: Posts,
    private projects: Projects,
    private reactions: Reactions,
    private runs: Runs,
  ) {}

  async get(): Promise<Stats> {
    const [posts, projects, reactions, runs] = await Promise.all([
      this.posts.count(),
      this.projects.count(),
      this.reactions.total(),
      this.runs.recent(10),
    ]);
    return { posts, projects, reactions, runs };
  }
}
