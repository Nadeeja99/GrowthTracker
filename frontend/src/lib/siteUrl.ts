// Absolute base URL for link previews, robots.txt and the sitemap. Vercel
// provides VERCEL_PROJECT_PRODUCTION_URL (a host name without the scheme); set
// NEXT_PUBLIC_SITE_URL to override it (e.g. a custom domain). A trailing slash
// is dropped so paths can be appended as `${siteUrl}/...`.
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || vercelUrl || 'http://localhost:3000').replace(/\/+$/, '');
