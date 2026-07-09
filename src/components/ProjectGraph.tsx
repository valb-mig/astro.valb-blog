import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/MultiSelect';

type GraphNode = {
  id: string;
  label: string;
  type: 'project' | 'post';
  slug: string;
  tags?: string[];
  x?: number;
  y?: number;
};

type GraphLink = { source: string; target: string };

interface Props {
  nodes: GraphNode[];
  links: GraphLink[];
  tags: string[];
}

const PROJECT_RADIUS = 6;
const POST_RADIUS = 3;

export default function ProjectGraph({ nodes, links, tags }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 560 });
  const [query, setQuery] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [colors, setColors] = useState({ dim: '#666', bright: '#eee', link: '#444' });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: 560 });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    setColors({
      dim: style.getPropertyValue('--muted-foreground').trim() || '#666',
      bright: style.getPropertyValue('--foreground').trim() || '#eee',
      link: style.getPropertyValue('--border').trim() || '#444',
    });
  }, []);

  const graphData = useMemo(
    () => ({
      nodes: nodes.map((n) => ({ ...n })),
      links: links.map((l) => ({ ...l })),
    }),
    [nodes, links],
  );

  const neighborsOf = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const l of links) {
      const s = typeof l.source === 'string' ? l.source : (l.source as any).id;
      const t = typeof l.target === 'string' ? l.target : (l.target as any).id;
      if (!map.has(s)) map.set(s, new Set());
      if (!map.has(t)) map.set(t, new Set());
      map.get(s)!.add(t);
      map.get(t)!.add(s);
    }
    return map;
  }, [links]);

  const filterActive = query.trim().length > 0 || activeTags.length > 0;

  const matchedProjectIds = useMemo(() => {
    if (!filterActive) return null;
    const q = query.trim().toLowerCase();
    const ids = new Set<string>();
    for (const n of nodes) {
      if (n.type !== 'project') continue;
      const matchesQuery = !q || n.label.toLowerCase().includes(q);
      const matchesTag = activeTags.length === 0 || (n.tags ?? []).some((t) => activeTags.includes(t));
      if (matchesQuery && matchesTag) ids.add(n.id);
    }
    return ids;
  }, [nodes, query, activeTags, filterActive]);

  const highlightedIds = useMemo(() => {
    if (!matchedProjectIds) return null;
    const ids = new Set(matchedProjectIds);
    for (const id of matchedProjectIds) {
      for (const neighbor of neighborsOf.get(id) ?? []) ids.add(neighbor);
    }
    return ids;
  }, [matchedProjectIds, neighborsOf]);

  const hoverSet = useMemo(() => {
    if (!hoverId) return null;
    const ids = new Set([hoverId]);
    for (const neighbor of neighborsOf.get(hoverId) ?? []) ids.add(neighbor);
    return ids;
  }, [hoverId, neighborsOf]);

  const isDimmed = (id: string) => {
    if (highlightedIds && !highlightedIds.has(id)) return true;
    if (hoverSet && !hoverSet.has(id)) return true;
    return false;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="buscar projeto por nome..."
          className="max-w-xs"
        />
        <MultiSelect
          initialValue={[]}
          options={tags.map((t) => ({ value: t, label: t }))}
          onChange={setActiveTags}
          placeholder="buscar tag..."
          triggerLabel="tags"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="mr-4">
          <span className="mr-1 inline-block size-2.5 rounded-full bg-foreground align-middle" /> projeto
        </span>
        <span>
          <span className="mr-1 inline-block size-1.5 rounded-full bg-muted-foreground align-middle" /> post
        </span>
      </p>

      <div ref={containerRef} className="overflow-hidden rounded-xl border border-border">
        <ForceGraph2D
          graphData={graphData}
          width={size.width}
          height={size.height}
          backgroundColor="transparent"
          nodeLabel={() => ''}
          linkColor={(link: any) => {
            const s = typeof link.source === 'string' ? link.source : link.source.id;
            const t = typeof link.target === 'string' ? link.target : link.target.id;
            return isDimmed(s) || isDimmed(t) ? 'transparent' : colors.link;
          }}
          linkWidth={1}
          onNodeHover={(node: any) => setHoverId(node ? node.id : null)}
          onNodeClick={(node: any) => {
            const href = node.type === 'project' ? `/projects/${node.slug}` : `/blog/${node.slug}`;
            window.location.href = href;
          }}
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const dimmed = isDimmed(node.id);
            const radius = node.type === 'project' ? PROJECT_RADIUS : POST_RADIUS;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = dimmed ? colors.link : node.type === 'project' ? colors.bright : colors.dim;
            ctx.fill();

            const showLabel = !dimmed && (hoverSet || globalScale > 2.2 || (highlightedIds && node.type === 'project'));
            if (showLabel) {
              const fontSize = 11 / globalScale;
              ctx.font = `${fontSize}px "Geist Variable", sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillStyle = colors.bright;
              ctx.fillText(node.label, node.x, node.y + radius + 2);
            }
          }}
          nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
            const radius = node.type === 'project' ? PROJECT_RADIUS : POST_RADIUS;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 2, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
          }}
        />
      </div>
    </div>
  );
}
