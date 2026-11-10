import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/siteUrl'

// Only the sign-in page is public; everything else needs an account.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: ['/auth', '/opengraph-image'], disallow: ['/api/', '/reset-password', '/today', '/plan', '/goals', '/habits', '/insights', '/settings'] },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
