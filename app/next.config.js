const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@sudam/shared', '@sudam/game-logic', '@sudam/database'],
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  webpack: (config, { isServer }) => {
    // Resolve workspace packages to their source directories
    // This ensures Next.js can find the packages during build
    config.resolve.alias = {
      ...config.resolve.alias,
      '@sudam/database': path.resolve(__dirname, '../packages/database/src'),
      '@sudam/game-logic': path.resolve(__dirname, '../packages/game-logic/src'),
      '@sudam/shared': path.resolve(__dirname, '../packages/shared/src'),
    };
    
    return config;
  },
};

module.exports = nextConfig;

