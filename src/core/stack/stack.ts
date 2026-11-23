export type Item = {
  id: string;
  sectionId: string;
  label: string;
  url: string | null;
  icon: string | null;
  color: string | null;
  order: number;
};

export type Section = {
  id: string;
  title: string;
  order: number;
  items: Item[];
};

export type SectionInput = Pick<Section, 'title' | 'order'>;

export type ItemInput = Omit<Item, 'id'>;
