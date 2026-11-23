import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, GripVertical, Pencil, Check, X } from 'lucide-react';
import { IconPicker } from '@/components/IconPicker';
import { ColorPicker } from '@/components/ColorPicker';
import { InlineIcon } from '@/components/InlineIcon';
import { faviconUrl } from '@/lib/icons';
import type { Item, Section } from '@/core/stack/stack';

type Draft = Pick<Item, 'label' | 'icon' | 'color'> & { url: string };

const blank: Draft = { label: '', url: '', icon: null, color: null };

function ItemIcon({ item }: { item: Pick<Item, 'icon' | 'color' | 'url'> }) {
  if (item.icon) {
    return <InlineIcon slug={item.icon} color={item.color} className="size-4 shrink-0 [&_svg]:size-full" />;
  }
  if (item.url) return <img src={faviconUrl(item.url)} alt="" width={16} height={16} loading="lazy" decoding="async" className="size-4 shrink-0" />;
  return null;
}

export function StackAdminPanel() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');

  const load = () => {
    fetch('/api/stack-sections')
      .then((res) => res.json())
      .then((data: Section[]) => setSections(data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const addSection = async () => {
    if (!title.trim()) return;
    const res = await fetch('/api/stack-sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), order: sections.length }),
    });
    if (res.ok) {
      setTitle('');
      toast.success('Seção criada.');
      load();
    } else {
      toast.error('Erro ao criar seção.');
    }
  };

  const renameSection = async (id: string, title: string) => {
    const res = await fetch(`/api/stack-sections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      setSections((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
      toast.success('Seção atualizada.');
    } else {
      toast.error('Erro ao atualizar seção.');
    }
  };

  const deleteSection = async (id: string) => {
    const res = await fetch(`/api/stack-sections/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSections((prev) => prev.filter((s) => s.id !== id));
      toast.success('Seção deletada.');
    } else {
      toast.error('Erro ao deletar seção.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle((e.target as HTMLInputElement).value)}
          placeholder="Nome da seção (ex: IDEs)"
          onKeyDown={(e) => e.key === 'Enter' && addSection()}
        />
        <Button onClick={addSection} className="shrink-0">
          <Plus size={14} />
          nova seção
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">carregando...</p>}
      {!loading && sections.length === 0 && (
        <p className="text-sm text-muted-foreground">nenhuma seção ainda.</p>
      )}

      {sections.map((section) => (
        <SectionCard
          key={section.id}
          section={section}
          onDelete={deleteSection}
          onRename={renameSection}
          onChange={load}
        />
      ))}
    </div>
  );
}

function SectionCard({
  section,
  onDelete,
  onRename,
  onChange,
}: {
  section: Section;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onChange: () => void;
}) {
  const [items, setItems] = useState(section.items);
  const [newItem, setNewItem] = useState<Draft>(blank);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(section.title);
  const [editing, setEditing] = useState<string | null>(null);
  const [itemDraft, setItemDraft] = useState<Draft>(blank);

  useEffect(() => setItems(section.items), [section.items]);

  const saveTitle = () => {
    const title = titleDraft.trim();
    if (!title || title === section.title) {
      setEditingTitle(false);
      setTitleDraft(section.title);
      return;
    }
    onRename(section.id, title);
    setEditingTitle(false);
  };

  const addItem = async () => {
    if (!newItem.label.trim()) return;
    const res = await fetch('/api/stack-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionId: section.id,
        label: newItem.label.trim(),
        url: newItem.url.trim() || null,
        icon: newItem.icon,
        color: newItem.color,
        order: items.length,
      }),
    });
    if (res.ok) {
      setNewItem(blank);
      toast.success('Item adicionado.');
      onChange();
    } else {
      toast.error('Erro ao adicionar item.');
    }
  };

  const startEditItem = (item: Item) => {
    setEditing(item.id);
    setItemDraft({ label: item.label, url: item.url ?? '', icon: item.icon, color: item.color });
  };

  const cancelEditItem = () => setEditing(null);

  const saveItem = async (id: string) => {
    if (!itemDraft.label.trim()) return;
    const res = await fetch(`/api/stack-items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: itemDraft.label.trim(),
        url: itemDraft.url.trim() || null,
        icon: itemDraft.icon,
        color: itemDraft.color,
      }),
    });
    if (res.ok) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                label: itemDraft.label.trim(),
                url: itemDraft.url.trim() || null,
                icon: itemDraft.icon,
                color: itemDraft.color,
              }
            : i,
        ),
      );
      setEditing(null);
      toast.success('Item atualizado.');
    } else {
      toast.error('Erro ao atualizar item.');
    }
  };

  const deleteItem = async (id: string) => {
    const res = await fetch(`/api/stack-items/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success('Item deletado.');
    } else {
      toast.error('Erro ao deletar item.');
    }
  };

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        {editingTitle ? (
          <div className="flex flex-1 items-center gap-1.5">
            <Input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') {
                  setEditingTitle(false);
                  setTitleDraft(section.title);
                }
              }}
            />
            <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={saveTitle}>
              <Check size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => {
                setEditingTitle(false);
                setTitleDraft(section.title);
              }}
            >
              <X size={14} />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <h3 className="font-medium">{section.title}</h3>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => setEditingTitle(true)}
            >
              <Pencil size={12} />
            </Button>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(section.id)}
        >
          <Trash2 size={14} />
          deletar seção
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        {items.map((item) =>
          editing === item.id ? (
            <div key={item.id} className="flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5">
              <IconPicker value={itemDraft.icon} onChange={(icon) => setItemDraft({ ...itemDraft, icon })} />
              {itemDraft.icon && (
                <ColorPicker
                  value={itemDraft.color}
                  onChange={(color) => setItemDraft({ ...itemDraft, color })}
                />
              )}
              <Input
                autoFocus
                value={itemDraft.label}
                onChange={(e) => setItemDraft({ ...itemDraft, label: (e.target as HTMLInputElement).value })}
                placeholder="nome"
                className="h-8"
                onKeyDown={(e) => e.key === 'Enter' && saveItem(item.id)}
              />
              <Input
                value={itemDraft.url}
                onChange={(e) => setItemDraft({ ...itemDraft, url: (e.target as HTMLInputElement).value })}
                placeholder="url (opcional)"
                className="h-8"
                onKeyDown={(e) => e.key === 'Enter' && saveItem(item.id)}
              />
              <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => saveItem(item.id)}>
                <Check size={14} />
              </Button>
              <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={cancelEditItem}>
                <X size={14} />
              </Button>
            </div>
          ) : (
            <div key={item.id} className="flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-sm">
              <GripVertical size={14} className="shrink-0 text-muted-foreground" />
              <ItemIcon item={item} />
              <span className="font-medium">{item.label}</span>
              {item.url && (
                <a href={item.url} target="_blank" className="truncate text-muted-foreground hover:underline">
                  {item.url}
                </a>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto size-6 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => startEditItem(item)}
              >
                <Pencil size={12} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => deleteItem(item.id)}
              >
                <Trash2 size={12} />
              </Button>
            </div>
          ),
        )}
        {items.length === 0 && <p className="text-xs text-muted-foreground">nenhum item ainda.</p>}
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <IconPicker value={newItem.icon} onChange={(icon) => setNewItem({ ...newItem, icon })} />
        {newItem.icon && (
          <ColorPicker
            value={newItem.color}
            onChange={(color) => setNewItem({ ...newItem, color })}
          />
        )}
        <Input
          value={newItem.label}
          onChange={(e) => setNewItem({ ...newItem, label: (e.target as HTMLInputElement).value })}
          placeholder="nome (ex: VS Code)"
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
        />
        <Input
          value={newItem.url}
          onChange={(e) => setNewItem({ ...newItem, url: (e.target as HTMLInputElement).value })}
          placeholder="url (opcional)"
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
        />
        <Button onClick={addItem} size="sm" className="shrink-0">
          <Plus size={14} />
        </Button>
      </div>
    </div>
  );
}
