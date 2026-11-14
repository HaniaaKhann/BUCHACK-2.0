export const PALETTE = {
  navy: '#384671',
  cream: '#E9F4C9',
  sky: '#3EADFF',
  berry: '#BB205C',
  cocoa: '#8B3A17',
  white: '#FFFFFF',
  muted: '#566286',
  paper: '#FAFCF2',
  blush: '#F0E5E1',
  mist: '#D8EFFF',
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
  { text: 'navy', on: 'paper', size: 'small', use: 'body text on the page surface' },
  { text: 'muted', on: 'paper', size: 'small', use: 'secondary text on the page surface' },
  {
    text: 'berry',
    on: 'paper',
    size: 'small',
    use: 'error text and tile initials on the page surface',
  },
  { text: 'cocoa', on: 'paper', size: 'small', use: 'warning text on the page surface' },
  { text: 'cocoa', on: 'blush', size: 'small', use: 'the demo banner and warning chips' },
  { text: 'navy', on: 'blush', size: 'small', use: 'text on a brown tint' },
  { text: 'cocoa', on: 'cream', size: 'small', use: 'tile initials on cream' },
  { text: 'navy', on: 'mist', size: 'small', use: 'text on a blue tint' },
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
