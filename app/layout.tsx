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
  title: 'EventCheckin',
  description: 'Event check-in management app',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
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
        {/* Google Analytics 4 (Google tag) */}
        <Script
          src={`https://www.googletagmanager.com/gtm.js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', {
              page_path: window.location.pathname,
            });
          `}
        </Script>

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
