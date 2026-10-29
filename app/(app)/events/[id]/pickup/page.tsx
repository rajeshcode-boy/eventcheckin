import { redirect } from 'next/navigation'

// Pickup now lives in the Desk hub. Old links and bookmarks land there.
export default async function PickupRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/events/${id}/desk?tab=pickup`)
}
