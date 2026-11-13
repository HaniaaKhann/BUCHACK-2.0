import type { NextConfig } from 'next';

const config: NextConfig = {
  ...(process.env['NEXT_OUTPUT_STANDALONE'] === '1' ? { output: 'standalone' as const } : {}),
  transpilePackages: ['@app/core', '@app/db', '@app/integrations'],
  experimental: {
    typedRoutes: true,
  },
};

export default config;
