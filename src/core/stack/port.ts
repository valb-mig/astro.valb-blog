import type { Item, ItemInput, Section, SectionInput } from './stack';

export interface Stack {
  sections(): Promise<Section[]>;
  title(section: string): Promise<string | null>;
  createSection(input: SectionInput): Promise<Section>;
  updateSection(id: string, input: Partial<SectionInput>): Promise<Section>;
  removeSection(id: string): Promise<void>;
  createItem(input: ItemInput): Promise<Item>;
  updateItem(id: string, input: Partial<ItemInput>): Promise<Item>;
  removeItem(id: string): Promise<void>;
}
