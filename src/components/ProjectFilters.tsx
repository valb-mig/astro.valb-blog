import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/MultiSelect';

interface Props {
  tags: string[];
}

export default function ProjectFilters({ tags }: Props) {
  const [query, setQuery] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    const cards = document.querySelectorAll<HTMLElement>('[data-project-card]');
    let visible = 0;

    cards.forEach((card) => {
      const title = (card.dataset.title ?? '').toLowerCase();
      const cardTags = (card.dataset.tags ?? '').split(' ').filter(Boolean);
      const matchesQuery = !q || title.includes(q);
      const matchesTags = activeTags.length === 0 || cardTags.some((t) => activeTags.includes(t));
      const show = matchesQuery && matchesTags;
      card.hidden = !show;
      if (show) visible++;
    });

    document.querySelectorAll<HTMLElement>('[data-section]').forEach((section) => {
      const hasVisible = section.querySelector('[data-project-card]:not([hidden])');
      section.hidden = !hasVisible;
    });

    const countEl = document.getElementById('results-count');
    if (countEl) countEl.textContent = `${visible} projeto${visible !== 1 ? 's' : ''}`;

    const emptyEl = document.getElementById('empty-state');
    if (emptyEl) emptyEl.hidden = visible !== 0;
  }, [query, activeTags]);

  return (
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
  );
}
