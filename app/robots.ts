import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/signup', '/privacy', '/terms'],
        disallow: [
          '/api/',
          '/admin',
          '/admin/*',
          '/organization',
          '/organization/*',
          '/events',
          '/events/*',
          '/dashboard',
        ],
      },
    ],
    sitemap: 'https://eventcheckin.tech/sitemap.xml',
  }
}
