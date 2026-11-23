export type Share = { name: string; percent: number; text: string };

export type Week = { total: string; languages: Share[] };

export type Day = { seconds: number; total: string; languages: Share[]; projects: Share[] };
