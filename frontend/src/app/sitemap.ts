import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${siteUrl}/auth`, changeFrequency: 'monthly', priority: 1 }]
}
