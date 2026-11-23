export const emojis = ['👍', '❤️', '🔥', '🎉', '👀'] as const;

export type Emoji = (typeof emojis)[number];

export const valid = (e: unknown): e is Emoji => emojis.includes(e as Emoji);
