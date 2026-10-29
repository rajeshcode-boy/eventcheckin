import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ROLE_LABELS, type EventRole } from '@/lib/permissions'

const TONE: Record<EventRole, string> = {
  owner: 'bg-primary text-primary-foreground',
  manager: 'bg-primary/15 text-primary',
  acquisition: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  staff: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
}

// The person's role on the event they are viewing, shown as a small pill.
export function RoleBadge({ role, className }: { role: EventRole; className?: string }) {
  return (
    <Badge className={cn(TONE[role], className)} title={`Your role on this event: ${ROLE_LABELS[role]}`}>
      {ROLE_LABELS[role]}
    </Badge>
  )
}
