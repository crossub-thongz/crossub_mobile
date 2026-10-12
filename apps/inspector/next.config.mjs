/** @type {import('next').NextConfig} */
const nextConfig = {
  // api-contract is symlinked from crossub_web; Turbopack cannot resolve it yet.
  transpilePackages: ['@crossub-thongz/api-contract', '@crossub/inspector-core'],
  images: {
    unoptimized: true,
  },
  experimental: {
    // BFF proxy forwards base64 photo uploads to the Nest API (≤ 25 MB per file).
    proxyClientMaxBodySize: '30mb',
  },
  async rewrites() {
    return [
      {
        source: '/.well-known/apple-app-site-association',
        destination: '/well-known/apple-app-site-association',
      },
      {
        source: '/.well-known/assetlinks.json',
        destination: '/well-known/assetlinks',
      },
    ];
  },
};

export default nextConfig;
