import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { emojis, type Emoji } from '@/core/reaction/emoji';
import type { Tally } from '@/core/reaction/service';

interface Props {
  post: string;
  tally: Tally;
}

export function ReactionBar({ post, tally }: Props) {
  const [counts, setCounts] = useState(tally.counts);
  const [reacted, setReacted] = useState(tally.reacted);
  const [pending, setPending] = useState<Emoji | null>(null);

  const react = async (emoji: Emoji) => {
    if (pending) return;
    setPending(emoji);

    const was = reacted[emoji];
    setCounts((c) => ({ ...c, [emoji]: (c[emoji] ?? 0) + (was ? -1 : 1) }));
    setReacted((r) => ({ ...r, [emoji]: !was }));

    const res = await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post, emoji }),
    });

    if (res.ok) {
      const data = await res.json();
      setCounts((c) => ({ ...c, [emoji]: data.count }));
      setReacted((r) => ({ ...r, [emoji]: data.reacted }));
    } else {
      setCounts((c) => ({ ...c, [emoji]: (c[emoji] ?? 0) + (was ? 1 : -1) }));
      setReacted((r) => ({ ...r, [emoji]: was }));
      if (res.status === 429) toast.error('Calma com os cliques :)');
    }
    setPending(null);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {emojis.map((emoji) => (
        <Button
          key={emoji}
          variant={reacted[emoji] ? 'secondary' : 'outline'}
          size="sm"
          disabled={pending === emoji}
          onClick={() => react(emoji)}
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
