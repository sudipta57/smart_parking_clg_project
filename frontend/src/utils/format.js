// Formatting helpers. All dates are shown in IST (Asia/Kolkata), whatever
// timezone the laptop running the browser is set to.

const TIMEZONE = 'Asia/Kolkata'
const IST_OFFSET = '+05:30'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

const pad = (n) => String(n).padStart(2, '0')

/** Split a Date into IST calendar parts: { year, month, day, hour, minute, second }. */
export function istParts(date = new Date()) {
  const p = {}
  for (const { type, value } of partsFormatter.formatToParts(date)) p[type] = Number(value)
  return p
}

/** ₹1,240 — Indian digit grouping (₹1,23,456). */
export function formatINR(amount) {
  return '₹' + Number(amount ?? 0).toLocaleString('en-IN')
}

/** "10:32 PM" */
export function formatTime(iso) {
  if (!iso) return '—'
  const { hour, minute } = istParts(new Date(iso))
  const period = hour < 12 ? 'AM' : 'PM'
  return `${hour % 12 || 12}:${pad(minute)} ${period}`
}

/** "18 Nov, 10:32 PM" */
export function formatDateTime(iso) {
  if (!iso) return '—'
  const { day, month } = istParts(new Date(iso))
  return `${day} ${MONTHS[month - 1]}, ${formatTime(iso)}`
}

/** "Wednesday, 18 Nov 2026" for a "YYYY-MM-DD" string. */
export function formatLongDate(ymd) {
  const [year, month, day] = ymd.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${weekday}, ${day} ${MONTHS[month - 1]} ${year}`
}

/** Live timer text from seconds: "02:40:05", or "1d 02:40:05" after a day. */
export function formatElapsed(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds % 60)}`
  return days ? `${days}d ${clock}` : clock
}

/** Same rule as the backend's format_duration: 160 -> "2h 40m", 1470 -> "1d 0h 30m". */
export function formatDuration(minutes) {
  if (minutes == null) return '—'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  if (days) return `${days}d ${hours}h ${mins}m`
  if (hours) return `${hours}h ${mins}m`
  return `${mins}m`
}

// ---- <input type="datetime-local"> helpers ----------------------------------
// The input works with "YYYY-MM-DDTHH:MM" (no timezone). We always treat it
// as IST and add "+05:30" before sending it to the API.

/** Today's date in IST as "YYYY-MM-DD". */
export function todayIST() {
  const { year, month, day } = istParts()
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Add N days to a "YYYY-MM-DD" string. */
export function addDays(ymd, days) {
  const [year, month, day] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

/** Current IST time as a datetime-local value. */
export function nowLocalInput() {
  return isoToLocalInput(new Date().toISOString())
}

/** ISO string (any offset) -> IST datetime-local value. */
export function isoToLocalInput(iso) {
  const { year, month, day, hour, minute } = istParts(new Date(iso))
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`
}

/** datetime-local value -> ISO 8601 with the IST offset, e.g. "2026-11-18T21:00:00+05:30". */
export function localInputToISO(value) {
  if (!value) return null
  const withSeconds = value.length === 16 ? `${value}:00` : value
  return withSeconds + IST_OFFSET
}
