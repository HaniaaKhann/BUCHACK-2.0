import type { Config } from 'tailwindcss';
import { PALETTE } from './src/theme';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      ...PALETTE,
    },
    extend: {},
  },
  plugins: [],
};

export default config;
