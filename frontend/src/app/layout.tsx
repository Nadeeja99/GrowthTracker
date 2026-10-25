import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { themeInitScript } from '@/contexts/ThemeContext'

// Exposed as a CSS variable so Tailwind's `font-sans` (see tailwind.config.ts) uses it.
const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })

const description = 'Plan your week, do the day, review it, and see what actually moves your goals, with an AI coach that reads your own data.'

// Absolute URLs for link previews. Render provides RENDER_EXTERNAL_URL; set
// NEXT_PUBLIC_SITE_URL to override (e.g. a custom domain).
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'GrowthTracker: plan, focus and review with an AI coach',
    template: '%s · GrowthTracker',
  },
  description,
  openGraph: {
    type: 'website',
    siteName: 'GrowthTracker',
    title: 'GrowthTracker',
    description,
    url: '/',
  },
  twitter: { card: 'summary_large_image', title: 'GrowthTracker', description },
  applicationName: 'GrowthTracker',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GrowthTracker',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Browser chrome matches the page background in each theme.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf9' },
    { media: '(prefers-color-scheme: dark)', color: '#121214' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint to avoid a light flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans" suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
