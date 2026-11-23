export type Repo = {
  repo: string;
  name: string;
  private: boolean;
  archived: boolean;
  pushedAt: string | null;
};

export interface Hub {
  memberships(): Promise<string[]>;
  org(login: string): Promise<string | null>;
  repos(org: string): Promise<Repo[]>;
}

export interface Trigger {
  run(): Promise<void>;
}
