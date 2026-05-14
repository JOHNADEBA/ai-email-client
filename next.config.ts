import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.dicebear.com' },
    ],
  },
}

export default nextConfig
