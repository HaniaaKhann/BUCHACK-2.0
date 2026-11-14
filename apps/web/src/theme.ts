export const PALETTE = {
  navy: '#384671',
  cream: '#E9F4C9',
  sky: '#3EADFF',
  berry: '#BB205C',
  cocoa: '#8B3A17',
  white: '#FFFFFF',
  muted: '#566286',
} as const;

export type PaletteName = keyof typeof PALETTE;

export type TextSize = 'small' | 'large';

export interface TextPair {
  text: PaletteName;
  on: PaletteName;
  size: TextSize;
  use: string;
}

export const TEXT_PAIRS: readonly TextPair[] = [
  { text: 'navy', on: 'cream', size: 'small', use: 'body text on the page' },
  { text: 'navy', on: 'white', size: 'small', use: 'body text on cards' },
  { text: 'muted', on: 'cream', size: 'small', use: 'secondary text on the page' },
  { text: 'muted', on: 'white', size: 'small', use: 'secondary text on cards' },
  { text: 'cream', on: 'navy', size: 'small', use: 'header, buttons, selected chips' },
  { text: 'white', on: 'berry', size: 'small', use: 'accent buttons' },
  { text: 'cream', on: 'berry', size: 'small', use: 'raspberry tiles' },
  { text: 'berry', on: 'white', size: 'small', use: 'error text on cards' },
  { text: 'berry', on: 'cream', size: 'small', use: 'error text on the page' },
  { text: 'white', on: 'cocoa', size: 'small', use: 'warning banners' },
  { text: 'cream', on: 'cocoa', size: 'small', use: 'brown tiles' },
  { text: 'cocoa', on: 'cream', size: 'small', use: 'warning text on the page' },
  { text: 'cocoa', on: 'white', size: 'small', use: 'warning text on cards' },
  { text: 'navy', on: 'sky', size: 'large', use: 'initial letter on a blue tile' },
];

export interface BoundaryPair {
  line: PaletteName;
  opacity: number;
  on: PaletteName;
  use: string;
}

export const BOUNDARY_PAIRS: readonly BoundaryPair[] = [
  { line: 'navy', opacity: 0.6, on: 'white', use: 'input and control borders' },
  { line: 'navy', opacity: 0.6, on: 'cream', use: 'control borders on the page' },
];
