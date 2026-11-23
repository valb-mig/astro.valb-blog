import type { Stack as Port } from '@/core/stack/port';
import type { Item, ItemInput, Section, SectionInput } from '@/core/stack/stack';
import { defined, must, type Db } from './client';

type ItemRow = {
  id: string;
  section_id: string;
  label: string;
  url: string | null;
  icon: string | null;
  icon_color: string | null;
  order_index: number;
};

type SectionRow = { id: string; title: string; order_index: number; stack_items?: ItemRow[] };

const item = (r: ItemRow): Item => ({
  id: r.id,
  sectionId: r.section_id,
  label: r.label,
  url: r.url,
  icon: r.icon,
  color: r.icon_color,
  order: r.order_index,
});

const section = (r: SectionRow): Section => ({
  id: r.id,
  title: r.title,
  order: r.order_index,
  items: (r.stack_items ?? []).map(item),
});

const sectionRow = (i: Partial<SectionInput>) => defined({ title: i.title, order_index: i.order });

const itemRow = (i: Partial<ItemInput>) =>
  defined({
    section_id: i.sectionId,
    label: i.label,
    url: i.url,
    icon: i.icon,
    icon_color: i.color,
    order_index: i.order,
  });

export class Stack implements Port {
  constructor(private db: Db) {}

  async sections(): Promise<Section[]> {
    const rows = must(
      await this.db
        .from('stack_sections')
        .select('*, stack_items(*)')
        .order('order_index', { ascending: true })
        .order('order_index', { ascending: true, referencedTable: 'stack_items' }),
    ) as SectionRow[];
    return rows.map(section);
  }

  async title(id: string): Promise<string | null> {
    const r = must(await this.db.from('stack_sections').select('title').eq('id', id).maybeSingle()) as {
      title: string;
    } | null;
    return r?.title ?? null;
  }

  async createSection(input: SectionInput): Promise<Section> {
    return section(must(await this.db.from('stack_sections').insert(sectionRow(input)).select().single()));
  }

  async updateSection(id: string, input: Partial<SectionInput>): Promise<Section> {
    return section(must(await this.db.from('stack_sections').update(sectionRow(input)).eq('id', id).select().single()));
  }

  async removeSection(id: string): Promise<void> {
    must(await this.db.from('stack_sections').delete().eq('id', id));
  }

  async createItem(input: ItemInput): Promise<Item> {
    return item(must(await this.db.from('stack_items').insert(itemRow(input)).select().single()));
  }

  async updateItem(id: string, input: Partial<ItemInput>): Promise<Item> {
    return item(must(await this.db.from('stack_items').update(itemRow(input)).eq('id', id).select().single()));
  }

  async removeItem(id: string): Promise<void> {
    must(await this.db.from('stack_items').delete().eq('id', id));
  }
}
