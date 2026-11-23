export interface Settings {
  get(key: string): Promise<string | null>;
  all(): Promise<{ [key: string]: string }>;
  set(key: string, value: string): Promise<void>;
}
