const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ['month', 2_592_000_000],
  ['week', 604_800_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

const format = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

export const ago = (iso: string, now = Date.now()) => {
  const diff = Date.parse(iso) - now;
  for (const [unit, ms] of units) if (Math.abs(diff) >= ms) return format.format(Math.round(diff / ms), unit);
  return 'agora';
};
