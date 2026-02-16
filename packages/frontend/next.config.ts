import type { NextConfig } from 'next';

const config: NextConfig = {
  experimental: {},
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default config;
