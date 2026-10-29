// Builds the lifecycle emails in emails/dist from one shared, email-safe layout.
// Run: node emails/build.mjs   (set SITE_URL to the final domain before pasting into Mailercloud)
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE = (process.env.SITE_URL || 'https://eventcheckin-five.vercel.app').replace(/\/$/, '')
const BOOKING = 'https://calendly.com/rajesh-emea/30min'
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'dist')

const C = {
  bg: '#F3F7F5',
  card: '#FFFFFF',
  primary: '#1A4439',
  live: '#007550',
  soft: '#D5EDE4',
  text: '#1A4439',
  muted: '#4F6B62',
  border: '#D5E2DC',
}
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

const link = (path, campaign) => {
  const url = new URL(path, SITE)
  url.searchParams.set('utm_source', 'mailercloud')
  url.searchParams.set('utm_medium', 'email')
  url.searchParams.set('utm_campaign', campaign)
  return url.toString()
}

const p = (html) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${C.text};">${html}</p>`
const h1 = (text) =>
  `<h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;color:${C.text};">${text}</h1>`
const muted = (html) => `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${C.muted};">${html}</p>`

// Table-based button: renders as a real button in Outlook, Gmail and Apple Mail
const button = (label, href) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr>
    <td align="center" bgcolor="${C.primary}" style="border-radius:10px;">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1;color:#FFFFFF;text-decoration:none;border-radius:10px;">${label} &rarr;</a>
    </td>
  </tr>
</table>`

const steps = (items) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
  ${items
    .map(
      (item, i) => `
  <tr>
    <td width="40" valign="top" style="padding:0 0 14px;">
      <div style="width:28px;height:28px;border-radius:14px;background:${C.soft};color:${C.live};font-size:14px;font-weight:800;line-height:28px;text-align:center;">${i + 1}</div>
    </td>
    <td valign="top" style="padding:3px 0 14px;font-size:15px;line-height:1.55;color:${C.text};">${item}</td>
  </tr>`
    )
    .join('')}
</table>`

const checklist = (items) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;background:${C.bg};border:1px solid ${C.border};border-radius:12px;">
  <tr><td style="padding:18px 20px 6px;">
  ${items
    .map(
      (item) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="28" valign="top" style="padding:0 0 12px;font-size:16px;line-height:1.5;color:${C.live};font-weight:800;">&#10003;</td>
        <td valign="top" style="padding:0 0 12px;font-size:15px;line-height:1.5;color:${C.text};">${item}</td>
      </tr>
    </table>`
    )
    .join('')}
  </td></tr>
</table>`

const stats = (items) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
  <tr>
    ${items
      .map(
        ([value, label]) => `
    <td width="${Math.floor(100 / items.length)}%" valign="top" style="padding:0 4px;">
      <div style="background:${C.bg};border:1px solid ${C.border};border-radius:12px;padding:16px 8px;text-align:center;">
        <div style="font-size:26px;font-weight:800;line-height:1.1;color:${C.live};">${value}</div>
        <div style="margin-top:6px;font-size:12px;line-height:1.3;color:${C.muted};">${label}</div>
      </div>
    </td>`
      )
      .join('')}
  </tr>
</table>`

const signature = `
<p style="margin:24px 0 0;font-size:16px;line-height:1.6;color:${C.text};">Rajesh<br>
<span style="font-size:14px;color:${C.muted};">Founder, EventCheckin</span></p>`

function layout({ title, preheader, body }) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${title}</title>
<style>
  body { margin:0; padding:0; width:100% !important; background:${C.bg}; }
  a { color:${C.live}; }
  @media only screen and (max-width:620px) {
    .container { width:100% !important; }
    .px { padding-left:22px !important; padding-right:22px !important; }
    h1 { font-size:23px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:${FONT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg};">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;font-family:${FONT};">
        <tr>
          <td style="padding:0 4px 20px;">
            <a href="${link('/', 'logo')}" target="_blank" style="text-decoration:none;color:${C.text};">
              <img src="${SITE}/icons/icon-192.png" width="36" height="36" alt="EventCheckin" style="display:inline-block;vertical-align:middle;border:0;border-radius:9px;">
              <span style="display:inline-block;vertical-align:middle;margin-left:10px;font-size:18px;font-weight:800;letter-spacing:-0.01em;color:${C.text};">EventCheckin</span>
            </a>
          </td>
        </tr>
        <tr>
          <td class="px" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:36px 40px;">
            ${body}
          </td>
        </tr>
        <tr>
          <td class="px" style="padding:24px 40px 0;text-align:center;font-size:12px;line-height:1.6;color:${C.muted};">
            You're receiving this because you created an EventCheckin account.<br>
            <a href="${link('/', 'footer')}" target="_blank" style="color:${C.muted};">EventCheckin</a> &middot;
            <a href="${BOOKING}" target="_blank" style="color:${C.muted};">Book a demo</a> &middot;
            <a href="{{UNSUBSCRIBE_URL}}" style="color:${C.muted};">Unsubscribe</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
`
}

const EMAILS = [
  {
    file: '01-welcome',
    subject: 'Welcome to EventCheckin, {{FIRST_NAME}}',
    preheader: 'Your first event is two minutes away.',
    trigger: 'Immediately after sign-up (contact added to the "EventCheckin organisers" list)',
    body: () => `
${h1('Welcome to EventCheckin, {{FIRST_NAME}}')}
${p("I'm Rajesh, and I built EventCheckin because event check-in shouldn't mean long queues, printed spreadsheets and guessing who turned up.")}
${p('Here is how most organisers get set up in an afternoon:')}
${steps([
  '<strong>Create your event.</strong> Add the date, venue and capacity.',
  '<strong>Add your guests.</strong> Import a CSV or Excel file, or share a registration link.',
  '<strong>Check guests in.</strong> Put one QR code at the entrance, or set up a tablet as a kiosk.',
])}
${button('Create your first event', link('/events/create', 'welcome'))}
${muted(`Questions, or want a hand setting up? Just reply to this email. It comes straight to me. Or <a href="${BOOKING}" target="_blank" style="color:${C.live};font-weight:600;">book a 30-minute call</a>.`)}
${signature}`,
  },
  {
    file: '02-no-event-day-1',
    subject: 'Set up your first event in 2 minutes',
    preheader: 'Three fields, and your guest list has a home.',
    trigger: '1 day after sign-up, only if the organiser has not created an event',
    body: () => `
${h1('Your first event takes 2 minutes')}
${p('Hi {{FIRST_NAME}}, you signed up yesterday but haven\'t created an event yet. Here\'s all it takes:')}
${checklist([
  '<strong>Name, date and venue</strong>, so guests know where to go',
  '<strong>Capacity</strong>, so you can see how full it is',
  '<strong>That\'s it.</strong> Guests, badges and check-in can come later.',
])}
${button('Create your event', link('/events/create', 'no-event-day-1'))}
${p("Once it's created, you'll get a registration link to share and a QR code for the door.")}
${signature}`,
  },
  {
    file: '03-no-event-day-3',
    subject: 'Want a hand with your first event?',
    preheader: 'A 30-minute call and you will leave with your event set up.',
    trigger: '3 days after sign-up, only if the organiser still has not created an event',
    body: () => `
${h1('Want me to set it up with you?')}
${p("Hi {{FIRST_NAME}}, getting started with a new tool is easy to put off, especially with an event coming up.")}
${p("So here's an offer: book a 30-minute call and we'll set up your event together. You'll leave with:")}
${checklist([
  'Your event created and your guest list imported',
  'A registration link ready to share',
  'A check-in plan for the door: QR code, kiosk or staff phones',
])}
${button('Book a 30-minute call', BOOKING)}
${muted(`Prefer to do it yourself? <a href="${link('/events/create', 'no-event-day-3')}" target="_blank" style="color:${C.live};font-weight:600;">Create your event here</a>.`)}
${signature}`,
  },
  {
    file: '05-event-created',
    subject: '{{EVENT_NAME}} is ready. Now add your guests',
    preheader: 'Import a spreadsheet or share a registration link.',
    trigger: 'When the organiser creates their first event',
    body: () => `
${h1('Nice work. Now add your guests')}
${p('Hi {{FIRST_NAME}}, <strong>{{EVENT_NAME}}</strong> is set up. The next step is your guest list. Pick whichever fits:')}
${steps([
  '<strong>Import a spreadsheet.</strong> Upload a CSV or Excel file, including exports from Jotform. Duplicates are flagged before they reach your list.',
  '<strong>Share a registration link.</strong> Guests sign themselves up, and you can approve them before the day.',
  '<strong>Add guests one by one</strong> for small events or VIPs.',
])}
${button('Add guests', link('/events', 'event-created'))}
${muted('Every guest gets a digital pass with a QR code, so check-in on the day takes seconds.')}
${signature}`,
  },
  {
    file: '10-day-before-event',
    subject: 'Tomorrow: your check-in checklist for {{EVENT_NAME}}',
    preheader: 'Ten minutes today means a smooth door tomorrow.',
    trigger: '1 day before the event date',
    body: () => `
${h1('{{EVENT_NAME}} is tomorrow')}
${p('Hi {{FIRST_NAME}}, ten minutes today makes for a smooth door tomorrow. Here is the checklist our organisers use:')}
${checklist([
  '<strong>Print the QR banner</strong> for the entrance, so guests can check themselves in.',
  '<strong>Pair your kiosk tablets</strong> with the 6-digit code. They keep working if the venue Wi-Fi drops.',
  '<strong>Add your onsite staff</strong> to the event so they can check guests in from their phones.',
  '<strong>Print badges</strong> if you need them, one per page or several per sheet.',
  '<strong>Keep the dashboard open</strong> on the day to watch arrivals live.',
])}
${button('Open my event', link('/events', 'day-before-event'))}
${muted(`Something not working? Reply to this email, or <a href="${BOOKING}" target="_blank" style="color:${C.live};font-weight:600;">book a quick call</a> today.`)}
${signature}`,
  },
  {
    file: '11-event-recap',
    subject: '{{EVENT_NAME}} in numbers',
    preheader: '{{CHECKED_IN}} guests checked in. Here is how it went.',
    trigger: 'The day after the event date',
    body: () => `
${h1('{{EVENT_NAME}} in numbers')}
${p('Hi {{FIRST_NAME}}, your event is done. Here is how the door went:')}
${stats([
  ['{{CHECKED_IN}}', 'Checked in'],
  ['{{ATTENDANCE_PCT}}%', 'Attendance'],
  ['{{WALK_INS}}', 'Walk-ins'],
])}
${p('The full report lists every guest, whether they checked in and who collected a badge. It\'s ready to download for your team or sponsors.')}
${button('Download the report', link('/events', 'event-recap'))}
${muted(`Planning another event? <a href="${link('/events/create', 'event-recap')}" target="_blank" style="color:${C.live};font-weight:600;">Set it up now</a> and your next guest list is one import away.`)}
${signature}`,
  },
]

mkdirSync(OUT, { recursive: true })
const index = []
for (const e of EMAILS) {
  const html = layout({ title: e.subject, preheader: e.preheader, body: e.body() })
  writeFileSync(join(OUT, `${e.file}.html`), html)
  index.push(`| \`${e.file}.html\` | ${e.subject} | ${e.trigger} |`)
}
writeFileSync(
  join(OUT, 'INDEX.md'),
  `# Lifecycle emails (generated by emails/build.mjs, site ${SITE})\n\n| File | Subject | Send when |\n|---|---|---|\n${index.join('\n')}\n`
)
console.log(`Built ${EMAILS.length} emails for ${SITE} in ${OUT}`)
