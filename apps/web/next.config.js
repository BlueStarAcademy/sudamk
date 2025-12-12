/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@sudam/shared', '@sudam/game-logic'],
};

module.exports = nextConfig;

