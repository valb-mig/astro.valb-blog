import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { REACTION_EMOJIS } from '@/lib/reaction-emojis';

interface Props {
  postId: string;
  initialCounts: Record<string, number>;
  initialReacted: Record<string, boolean>;
}

export function ReactionBar({ postId, initialCounts, initialReacted }: Props) {
  const [counts, setCounts] = useState(initialCounts);
  const [reacted, setReacted] = useState(initialReacted);
  const [pending, setPending] = useState<string | null>(null);

  const handleReact = async (emoji: string) => {
    if (pending) return;
    setPending(emoji);

    const wasReacted = reacted[emoji];
    setCounts((c) => ({ ...c, [emoji]: (c[emoji] ?? 0) + (wasReacted ? -1 : 1) }));
    setReacted((r) => ({ ...r, [emoji]: !wasReacted }));

    const res = await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, emoji }),
    });

    if (res.ok) {
      const data = await res.json();
      setCounts((c) => ({ ...c, [emoji]: data.count }));
      setReacted((r) => ({ ...r, [emoji]: data.reacted }));
    } else {
      // reverte otimismo (inclui 429 de rate-limit)
      setCounts((c) => ({ ...c, [emoji]: (c[emoji] ?? 0) + (wasReacted ? 1 : -1) }));
      setReacted((r) => ({ ...r, [emoji]: wasReacted }));
      if (res.status === 429) toast.error('Calma com os cliques :)');
    }
    setPending(null);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {REACTION_EMOJIS.map((emoji) => (
        <Button
          key={emoji}
          variant={reacted[emoji] ? 'secondary' : 'outline'}
          size="sm"
          disabled={pending === emoji}
          onClick={() => handleReact(emoji)}
          className="gap-1.5 transition-opacity disabled:opacity-60"
        >
          {pending === emoji ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <span>{emoji}</span>
          )}
          <span className="text-xs text-muted-foreground">{counts[emoji] ?? 0}</span>
        </Button>
      ))}
    </div>
  );
}
