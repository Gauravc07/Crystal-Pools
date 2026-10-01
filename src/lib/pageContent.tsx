import { Fragment, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase, mediaUrl } from './supabase';
import { allFields } from '../content/types';
import type { FieldKey, PageSchema } from '../content/types';

type Overrides = Record<string, Record<string, unknown>>;

let resolved: Overrides | null = null;
let pending: Promise<Overrides> | null = null;

/** Loads every saved override once per page load (the table is small). */
export function loadPageContent(): Promise<Overrides> {
  if (resolved) return Promise.resolve(resolved);
  pending ??= (async () => {
    const { data } = await supabase.from('page_content').select('page, key, value');
    const map: Overrides = {};
    for (const row of data ?? []) (map[row.page] ??= {})[row.key] = row.value;
    resolved = map;
    return map;
  })().catch(() => (resolved = {}));
  return pending;
}

export const pageImage = (value: string | null | undefined) => mediaUrl('pages', value) ?? '';

/**
 * Content for one page: admin overrides where they exist, the built-in defaults otherwise.
 *   const c = usePageContent(schema);
 *   c.text('hero.title') · c.image('hero.image') · c.list('features')
 */
export function usePageContent<S extends PageSchema>(schema: S) {
  const [overrides, setOverrides] = useState<Record<string, unknown>>(resolved?.[schema.id] ?? {});

  useEffect(() => {
    let active = true;
    loadPageContent().then(all => active && setOverrides(all[schema.id] ?? {}));
    return () => { active = false; };
  }, [schema.id]);

  return useMemo(() => {
    const fields = allFields(schema);
    const field = (key: string) => {
      const f = fields[key];
      if (!f && import.meta.env.DEV) console.warn(`[content] "${schema.id}" has no field "${key}"`);
      return f;
    };
    const text = (key: FieldKey<S>): string => {
      const v = overrides[key];
      const f = field(key);
      return typeof v === 'string' && v.trim() ? v : f && f.type === 'text' ? f.default : '';
    };
    const image = (key: FieldKey<S>): string => {
      const v = overrides[key];
      const f = field(key);
      return pageImage(typeof v === 'string' && v ? v : f && f.type === 'image' ? f.default : '');
    };
    const list = (key: FieldKey<S>): Record<string, string>[] => {
      const v = overrides[key];
      const f = field(key);
      const fallback = f && f.type === 'list' ? f.default : [];
      if (!Array.isArray(v) || !f || f.type !== 'list') return fallback;
      const items = v as Record<string, string>[];
      // Resizable lists (items added/removed/reordered) are taken exactly as saved
      if (f.resizable) {
        return items.map(item => Object.fromEntries(Object.keys(f.item).map(sub => [sub, item?.[sub] ?? ''])));
      }
      // Fixed lists: empty sub-fields fall back to the default item's value
      return items.map((item, i) => {
        const merged: Record<string, string> = {};
        for (const sub of Object.keys(f.item)) merged[sub] = item?.[sub]?.trim() ? item[sub] : fallback[i]?.[sub] ?? '';
        return merged;
      });
    };
    return { text, image, list };
  }, [schema, overrides]);
}

/** Renders text where *starred words* are highlighted, e.g. "with *speed* and *efficiency*". */
export function Highlighted({ text, className }: { text: string; className: string }): ReactNode {
  return text.split(/(\*[^*]+\*)/g).map((part, i) =>
    part.startsWith('*') && part.endsWith('*') && part.length > 2
      ? <span key={i} className={className}>{part.slice(1, -1)}</span>
      : <Fragment key={i}>{part}</Fragment>,
  );
}

/** "LABEL | subtitle" lines → [{ label, sub }] (used for small feature rows). */
export function parsePairs(text: string) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [label, ...rest] = line.split('|');
    return { label: label.trim(), sub: rest.join('|').trim() };
  });
}

/** Renders text with its line breaks kept (admins can't type HTML). */
export function Lines({ text }: { text: string }): ReactNode {
  const parts = text.split('\n');
  return parts.map((line, i) => (
    <Fragment key={i}>
      {line}
      {i < parts.length - 1 && <br />}
    </Fragment>
  ));
}
