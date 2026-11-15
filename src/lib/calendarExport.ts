import { LiveEvent } from './live'

// "Aggiungi al calendario" per una live o un promemoria: Google Calendar (link)
// oppure file .ics (Apple Calendario, Outlook…).

const pad = (n: number) => String(n).padStart(2, '0')
const utc = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`

function range(e: LiveEvent): { start: Date; end: Date } | null {
  if (!e.startsAt) return null
  const start = new Date(e.startsAt)
  const end = new Date(start.getTime() + (e.durationMinutes && e.durationMinutes > 0 ? e.durationMinutes : 60) * 60_000)
  return { start, end }
}

const liveUrl = (e: LiveEvent) => `${window.location.origin}/student/live/${e.id}`
const details = (e: LiveEvent) => [e.description, e.eventType === 'reminder' ? '' : `Apri la live: ${liveUrl(e)}`].filter(Boolean).join('\n\n')

export function googleCalendarUrl(e: LiveEvent): string | null {
  const r = range(e); if (!r) return null
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${utc(r.start)}/${utc(r.end)}`, details: details(e) })
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')

export function downloadIcs(e: LiveEvent): void {
  const r = range(e); if (!r) return
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Space Traders Institute//IST//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.id}@ist`, `DTSTAMP:${utc(new Date())}`, `DTSTART:${utc(r.start)}`, `DTEND:${utc(r.end)}`,
    `SUMMARY:${esc(e.title)}`, `DESCRIPTION:${esc(details(e))}`,
    ...(e.eventType === 'reminder' ? [] : [`URL:${liveUrl(e)}`]),
    'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${e.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'evento'}.ics`
  document.body.appendChild(a); a.click(); a.remove()
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
