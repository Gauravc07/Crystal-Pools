// Editable page content: shared by the website (defaults + rendering) and the
// admin panel (edit forms). Plain data only — no React — so the admin can import it.

export interface TextField {
  type: 'text';
  label: string;
  default: string;
  /** Show a multi-line box in the admin. Line breaks are kept on the website. */
  multiline?: boolean;
  help?: string;
}

export interface ImageField {
  type: 'image';
  label: string;
  /** Path under the website's public folder, e.g. /images/hero/light-mode.webp */
  default: string;
  help?: string;
}

export interface FileField {
  type: 'file';
  label: string;
  /** Path under the website's public folder, e.g. /documents/brochure.pdf (empty = none) */
  default: string;
  help?: string;
}

export type ItemField = Omit<TextField, 'default'> | Omit<ImageField, 'default'> | Omit<FileField, 'default'>;

export interface ListField {
  type: 'list';
  label: string;
  /** Sub-fields of each item */
  item: Record<string, ItemField>;
  default: Record<string, string>[];
  help?: string;
  /** Admins may add, remove and reorder items (otherwise the number of items is fixed by the layout). */
  resizable?: boolean;
}

export type Field = TextField | ImageField | FileField | ListField;

export interface Section {
  title: string;
  fields: Record<string, Field>;
}

export interface PageSchema {
  /** Stable id stored in the database (lowercase letters, digits, hyphens) */
  id: string;
  label: string;
  /** Website URL of the page */
  path: string;
  group: 'Main pages' | 'Pool types' | 'Services' | 'Products';
  sections: Section[];
}

/** Union of all field keys declared in a schema (for type-safe lookups). */
export type FieldKey<S extends PageSchema> = S['sections'][number] extends infer Sec
  ? Sec extends { fields: infer F } ? Extract<keyof F, string> : never
  : never;

export function allFields(schema: PageSchema): Record<string, Field> {
  return Object.assign({}, ...schema.sections.map(s => s.fields));
}

/** Standard SEO section every page gets. */
export function seoSection(title: string, description: string): Section {
  return {
    title: 'SEO',
    fields: {
      'seo.title': { type: 'text', label: 'Page title (browser tab & Google)', default: title, help: 'About 50–60 characters. " | Crystal Pools" is added automatically.' },
      'seo.description': { type: 'text', label: 'Meta description', default: description, multiline: true, help: 'About 150–160 characters, shown under the title in Google.' },
    },
  };
}
