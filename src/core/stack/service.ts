import type { Service as Updates } from '../update/service';
import type { Stack } from './port';
import type { Item, ItemInput, Section, SectionInput } from './stack';

export class Service {
  constructor(
    private stack: Stack,
    private updates: Updates,
  ) {}

  sections(): Promise<Section[]> {
    return this.stack.sections();
  }

  createSection(input: SectionInput): Promise<Section> {
    return this.stack.createSection(input);
  }

  updateSection(id: string, input: Partial<SectionInput>): Promise<Section> {
    return this.stack.updateSection(id, input);
  }

  removeSection(id: string): Promise<void> {
    return this.stack.removeSection(id);
  }

  async createItem(input: ItemInput): Promise<Item> {
    const item = await this.stack.createItem(input);
    const section = await this.stack.title(item.sectionId);
    await this.updates.announce(
      'stack_item',
      section ? `Nova ferramenta em ${section}: ${item.label}` : `Nova ferramenta: ${item.label}`,
      item.url,
    );
    return item;
  }

  updateItem(id: string, input: Partial<ItemInput>): Promise<Item> {
    return this.stack.updateItem(id, input);
  }

  removeItem(id: string): Promise<void> {
    return this.stack.removeItem(id);
  }
}
