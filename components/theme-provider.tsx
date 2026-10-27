'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

// Wraps next-themes so Light/Dark/System all work. "light" is still the
// default for a first-time visitor (fixed earlier); picking "system"
// afterwards is an explicit choice, not the default.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="data-theme" defaultTheme="light" enableSystem>
      {children}
    </NextThemesProvider>
  )
}
