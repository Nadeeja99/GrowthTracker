import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'

// Only the sign-in page is public; everything else needs an account.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: ['/auth', '/opengraph-image'], disallow: ['/api/', '/today', '/plan', '/goals', '/habits', '/insights', '/settings'] },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
