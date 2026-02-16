/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://api:3001/api/:path*',
      },
      {
        source: '/auth/:path*',
        destination: 'http://api:3001/auth/:path*',
      },
      {
        source: '/contacts/:path*',
        destination: 'http://api:3001/contacts/:path*',
      },
      {
        source: '/campaigns/:path*',
        destination: 'http://api:3001/campaigns/:path*',
      },
      {
        source: '/integrations/:path*',
        destination: 'http://api:3001/integrations/:path*',
      },
      {
        source: '/webhooks/:path*',
        destination: 'http://api:3001/webhooks/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
