import {
  BadgeCheck,
  ClipboardList,
  FileSpreadsheet,
  Link2,
  QrCode,
  ScanLine,
  Users,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'

export const BOOKING_URL = 'https://calendar.app.google/3hM36DLLUM6zmZdH7'
export const CONTACT_EMAIL = 'rajesh.emea@gmail.com'

export const NAV_LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#demo', label: 'Demo' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/#faq', label: 'FAQ' },
]

export const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: QrCode,
    title: 'QR check-in at the door',
    body: 'Put one QR code at the entrance. Guests scan it, enter their email or phone, and they are in. Nobody gets checked in twice.',
  },
  {
    icon: ScanLine,
    title: 'Self-service kiosk',
    body: 'Pair a tablet with a 6-digit code and it becomes a scanning kiosk. Guests scan the QR on their pass and get a full-screen welcome.',
  },
  {
    icon: WifiOff,
    title: 'Keeps working offline',
    body: 'If the venue Wi-Fi drops, the kiosk keeps scanning. Check-ins are saved on the tablet and upload by themselves when it reconnects.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Import your guest list',
    body: 'Upload a CSV or Excel file, including exports from Jotform. Duplicate guests are flagged before they reach your list.',
  },
  {
    icon: Link2,
    title: 'Registration links',
    body: 'Share a public sign-up link for your event. Give each team its own referral code and approve registrations before the day.',
  },
  {
    icon: BadgeCheck,
    title: 'Digital passes and printed badges',
    body: 'Every guest gets a digital pass with a QR code they can save to their phone. Print badges as a PDF, one per page or several per sheet.',
  },
  {
    icon: ClipboardList,
    title: 'Badge pickup desk',
    body: 'Scan a guest’s QR or type their registration ID at the desk and mark their badge as collected, so nobody walks away with two.',
  },
  {
    icon: Users,
    title: 'Roles for your whole team',
    body: 'Owners, event managers, delegate acquisition and onsite staff each see only the parts of the event their job needs.',
  },
]

export const COMING_SOON = [
  { title: 'Live sync with Jotform, Eventbrite and Typeform', body: 'New registrations will arrive automatically, without exporting a file.' },
  { title: 'Direct thermal badge printing', body: 'Badges will print straight to Zebra and Brother label printers at check-in.' },
  { title: 'API and webhooks', body: 'Send check-ins to your CRM or your own systems as they happen.' },
]

export const STEPS = [
  {
    title: 'Create your event',
    body: 'Add the date and venue, then import your guest list or share a registration link.',
    tag: 'Takes a few minutes',
  },
  {
    title: 'Check guests in',
    body: 'Staff check people in from their phones, or guests scan their pass at a kiosk.',
    tag: 'Phone, tablet or laptop',
  },
  {
    title: 'Watch it live',
    body: 'See arrivals, walk-ins and no-shows on the dashboard as they happen, then download the report.',
    tag: 'Report as CSV',
  },
]

export const BETA_INCLUDES = [
  'Unlimited events and guests',
  'QR check-in and walk-in sign-up',
  'Self-service kiosks with offline mode',
  'Digital passes and PDF badge printing',
  'Registration links with referral codes',
  'Live dashboard and CSV reports',
  'Team roles and push notifications',
]

export const FAQS = [
  {
    q: 'What happens if the venue Wi-Fi goes down?',
    a: 'Kiosks keep scanning. Each check-in is saved on the tablet and uploads by itself when the connection comes back. Staff checking guests in from their own phones need a connection, which mobile data usually covers.',
  },
  {
    q: 'Do guests or staff need to install an app?',
    a: 'No. EventCheckin runs in the web browser on any phone, tablet or laptop. Guests can add their digital pass to their phone’s home screen if they want it handy.',
  },
  {
    q: 'How do I bring in my guest list?',
    a: 'Upload a CSV or Excel file from the Guests page. Forms like Jotform can export to CSV. EventCheckin flags duplicate guests before importing, and you can also add guests one by one or let them register through your event’s link.',
  },
  {
    q: 'Which badge printers can I use?',
    a: 'Badges are made as a PDF, so any printer that can print a PDF works, from an office printer to a label printer. You can print one badge per page or several per sheet. Printing straight to thermal label printers is coming soon.',
  },
  {
    q: 'Is it really free?',
    a: 'Yes. Every feature is free while EventCheckin is in beta. If you are planning a large event or want help setting up, book a call with us.',
  },
  {
    q: 'How is guest data protected?',
    a: 'All traffic is encrypted over HTTPS, and every organisation can only see its own events and guests. Team members only see the parts of an event their role allows. Read the Privacy Policy for the details.',
  },
]
