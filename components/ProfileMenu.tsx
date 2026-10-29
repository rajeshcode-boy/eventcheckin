'use client'

import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Props {
  name: string
  email: string
  avatarUrl: string | null
  onLogout: () => void
}

// Avatar button that opens a menu with the account and the log out action
export default function ProfileMenu({ name, email, avatarUrl, onLogout }: Props) {
  const initial = (name || email || '?').charAt(0).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" aria-label={`Account menu for ${name || email}`} className="rounded-full">
            <Avatar>
              {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-semibold">{name || 'Signed in'}</p>
          <p className="truncate text-[13px] font-normal text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile">My profile</Link>} />
        <DropdownMenuItem render={<Link href="/organization">Organization settings</Link>} />
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onLogout}>
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
