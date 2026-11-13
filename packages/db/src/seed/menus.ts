import type { MenuFile, MenuItemSeed } from './schemas.js';

export const KAGGLE_OUTLETS: readonly string[] = [
  'Bistro NTT',
  'Café@CVA Commons',
  'Harmony Lounge',
  'iCafe',
  'JCCC UG/F Cafe',
  'JCCC G/F Cafe',
];

export interface MergedMenuItem extends MenuItemSeed {
  outletName: string;
  source: 'generic' | 'kaggle';
  isDemo: true;
}

function tag(file: MenuFile): MergedMenuItem[] {
  return file.outlets.flatMap((outlet) =>
    outlet.items.map((item) => ({
      ...item,
      outletName: outlet.outletName,
      source: file.source,
      isDemo: true as const,
    })),
  );
}

export function mergeMenus(generic: MenuFile, kaggle: MenuFile | null): MergedMenuItem[] {
  const merged = new Map<string, MergedMenuItem>();
  const key = (item: MergedMenuItem): string => `${item.outletName}\u0000${item.name}`;

  for (const item of tag(generic)) merged.set(key(item), item);

  if (kaggle) {
    for (const item of tag(kaggle)) {
      if (!KAGGLE_OUTLETS.includes(item.outletName)) {
        throw new Error(`Kaggle menu targets "${item.outletName}", which is not a Kaggle outlet`);
      }
      merged.set(key(item), item);
    }
  }

  return [...merged.values()];
}
