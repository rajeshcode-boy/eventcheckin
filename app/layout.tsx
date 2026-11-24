import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import ProductAnalytics from '@/components/Analytics'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-NJXY2K8DVN'

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  metadataBase: new URL('https://eventcheckin.tech'),
  title: {
    default: 'EventCheckin - Hassle-Free QR Event Check-in & Badge Printing',
    template: '%s | EventCheckin',
  },
  description:
    'Welcome every guest with hassle-free QR check-in, digital attendee passes, live badge printing, and offline self-service kiosks for conferences and corporate expos.',
  keywords: [
    'event check in',
    'QR check-in app',
    'badge printing software',
    'conference check in',
    'attendee management',
    'event check in kiosk',
    'digital event pass',
  ],
  authors: [{ name: 'EventCheckin Team' }],
  creator: 'EventCheckin',
  publisher: 'EventCheckin',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  verification: {
    google: 'O_2tECLUgsrHB-vYHEzCwu1cIhZtg0mj6ybXB1D2WsE',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://eventcheckin.tech',
    title: 'EventCheckin - Hassle-Free QR Event Check-in & Badge Printing',
    description:
      'Fast, reliable QR check-in, digital attendee passes, and live badge printing for modern conferences and expos.',
    siteName: 'EventCheckin',
    images: [
      {
        url: '/linkedin/linkedin-cover-banner.png',
        width: 1200,
        height: 630,
        alt: 'EventCheckin Platform Preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EventCheckin - Hassle-Free QR Event Check-in',
    description:
      'Fast, reliable QR check-in, digital attendee passes, and live badge printing for modern events.',
    images: ['/linkedin/linkedin-cover-banner.png'],
  },
  // Lets the app open full screen from the iPhone home screen, where web push works
  appleWebApp: {
    capable: true,
    title: 'EventCheckin',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#1A4439',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <head>
        {/* iOS sets navigator.standalone from this tag; Next only emits the non-prefixed one */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {/* Google Tag Manager (GTM-5S9SWNPC) */}
        <Script
          src="https://www.googletagmanager.com/gtm.js?id=GTM-5S9SWNPC"
          strategy="afterInteractive"
        />
        {/* Google Analytics 4 (G-NJXY2K8DVN) */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', {
              page_path: window.location.pathname,
            });
            gtag('config', 'GTM-5S9SWNPC');
          `}
        </Script>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-5S9SWNPC"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>

        <ThemeProvider>
          {children}
        </ThemeProvider>
        <Analytics />
        <ProductAnalytics />
        <Toaster />
      </body>
    </html>
  )
}
