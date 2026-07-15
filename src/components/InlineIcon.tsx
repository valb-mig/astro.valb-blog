import { useEffect, useState } from 'react';

const cache = new Map<string, string>();

export function InlineIcon({
  slug,
  color,
  className,
}: {
  slug: string;
  color?: string | null;
  className?: string;
}) {
  const [svg, setSvg] = useState<string | null>(cache.get(slug) ?? null);

  useEffect(() => {
    if (cache.has(slug)) {
      setSvg(cache.get(slug)!);
      return;
    }
    setSvg(null);
    fetch(`/api/icons/${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { svg: string } | null) => {
        if (!data) return;
        cache.set(slug, data.svg);
        setSvg(data.svg);
      });
  }, [slug]);

  const style = color ? { color } : undefined;
  if (!svg) return <span className={className} style={style} />;
  return <span className={className} style={style} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function cacheIcon(slug: string, svg: string) {
  cache.set(slug, svg);
}
