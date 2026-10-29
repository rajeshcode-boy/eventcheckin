# Lifecycle emails

Branded HTML emails for the organiser journey, sent through Mailercloud.
`dist/INDEX.md` lists every email with its subject and when to send it.

## Rebuild

The emails link to the live site. When the custom domain is live, rebuild with it:

```bash
SITE_URL=https://yourdomain.com node emails/build.mjs
```

Edit wording in `build.mjs`, not in `dist/`, so all emails keep the same layout.

## Placeholders to swap in Mailercloud

Mailercloud's editor has its own personalisation tags. After pasting an email's HTML,
replace each placeholder below with the matching tag from Mailercloud's personalise menu.

| Placeholder | Meaning | Mailercloud source |
|---|---|---|
| `{{FIRST_NAME}}` | Organiser's first name | Built-in first name field |
| `{{EVENT_NAME}}` | Name of their event | Custom field `event_name` |
| `{{CHECKED_IN}}` | Guests checked in | Custom field `last_event_checked_in` |
| `{{ATTENDANCE_PCT}}` | Attendance %, whole number | Custom field `last_event_attendance_pct` |
| `{{WALK_INS}}` | Walk-in guests | Custom field `last_event_walk_ins` |
| `{{UNSUBSCRIBE_URL}}` | Unsubscribe link (required) | Mailercloud's unsubscribe link |

The custom fields are filled in by the app once the Mailercloud sync is built.
