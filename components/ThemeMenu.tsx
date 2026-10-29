'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

// Light, Dark or System. "light" is the default for a browser that has never
// chosen (fixed earlier); picking System here is an explicit opt-in.
export default function ThemeMenu() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  // Avoids a server/client mismatch: next-themes only knows the real value after mount
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const ActiveIcon = mounted && resolvedTheme === 'dark' ? Moon : Sun

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon" aria-label="Change theme">
            <ActiveIcon />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {OPTIONS.map((opt) => (
          <DropdownMenuItem key={opt.value} onClick={() => setTheme(opt.value)}>
            <opt.icon />
            {opt.label}
            {mounted && theme === opt.value && <span className="ml-auto">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
