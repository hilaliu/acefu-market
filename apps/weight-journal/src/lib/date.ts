const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

/** Local calendar date as `YYYY-MM-DD`; never UTC, so a late evening stays on its day. */
export function dateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Parses a date key at local noon, which keeps DST arithmetic inside the same day. */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year ?? 2000, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0)
}

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false
  const date = parseDateKey(value)
  return dateKey(date) === value
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / 86_400_000)
}

export function todayKey(): string {
  return dateKey()
}

export function yesterdayKey(): string {
  return addDays(todayKey(), -1)
}

export function formatDay(key: string): string {
  const date = parseDateKey(key)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export function formatWeekday(key: string): string {
  return WEEKDAYS[parseDateKey(key).getDay()] ?? ''
}

export function formatFullDay(key: string): string {
  return `${formatDay(key)} ${formatWeekday(key)}`
}

export function formatShort(key: string): string {
  const date = parseDateKey(key)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function formatClock(iso: string | undefined): string {
  if (!iso)
    return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime()))
    return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** A run of consecutive date keys ending at `end` (inclusive). */
export function rangeEndingAt(end: string, count: number): string[] {
  const keys: string[] = []
  for (let offset = count - 1; offset >= 0; offset -= 1)
    keys.push(addDays(end, -offset))
  return keys
}

export function isToday(key: string): boolean {
  return key === todayKey()
}

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime())
}
