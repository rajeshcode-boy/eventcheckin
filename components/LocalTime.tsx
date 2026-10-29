'use client'

import { useEffect, useState } from 'react'
import { formatTime } from '@/lib/time'

// Shows a time in the viewer's own time zone. Server-rendered pages run in UTC, so this fills in after load.
export default function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState('')
  useEffect(() => setText(formatTime(iso)), [iso])
  return <time dateTime={iso}>{text}</time>
}
