export const env = (key: string): string | undefined =>
  (import.meta.env?.[key] as string | undefined) ?? process.env[key] ?? undefined;
