/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@sudam/shared', '@sudam/game-logic'],
  // Disable static page generation to avoid tRPC client initialization errors
  output: 'standalone',
  // Skip static optimization for pages that use tRPC
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

module.exports = nextConfig;

