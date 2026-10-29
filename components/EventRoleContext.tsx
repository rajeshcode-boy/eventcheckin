'use client'

import { createContext, useContext } from 'react'
import type { EventRole } from '@/lib/permissions'

// The signed-in user's role on the event being viewed, set by app/(app)/events/[id]/layout.tsx.
const EventRoleContext = createContext<EventRole | null>(null)

export const EventRoleProvider = EventRoleContext.Provider
export const useEventRole = () => useContext(EventRoleContext)
