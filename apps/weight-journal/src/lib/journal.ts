import type { DailyChange, DayRecord, DayView, JournalState, NightChange, Unit, WeighIn } from '../types'
import { addDays, daysBetween, isDateKey, isValidTime, rangeEndingAt } from './date'

export const WEIGHT_MIN_KG = 20
export const WEIGHT_MAX_KG = 300
export const STORAGE_KEY = 'weight-journal:v1'

export function emptyState(): JournalState {
  const now = Date.now()
  return {
    version: 1,
    unit: 'kg',
    records: {},
    createdAt: now,
    updatedAt: now,
  }
}

export function unitName(unit: Unit): string {
  return unit === 'jin' ? '斤' : '公斤'
}

export function unitSuffix(unit: Unit): string {
  return unit === 'jin' ? '斤' : 'kg'
}

export function fromKg(kg: number, unit: Unit): number {
  return unit === 'jin' ? kg * 2 : kg
}

export function toKg(value: number, unit: Unit): number {
  return unit === 'jin' ? value / 2 : value
}

export function roundWeight(kg: number): number {
  return Math.round(kg * 100) / 100
}

export function inputBounds(unit: Unit): { min: number, max: number } {
  return unit === 'jin' ? { min: 40, max: 600 } : { min: 20, max: 300 }
}

export function formatWeight(kg: number, unit: Unit, digits = 1): string {
  return fromKg(kg, unit).toFixed(digits)
}

/** Input text keeps up to two decimals without padding: 72.3, not 72.30. */
export function formatInputWeight(kg: number, unit: Unit): string {
  return Number(fromKg(kg, unit).toFixed(2)).toString()
}

export function formatSigned(kg: number, unit: Unit, digits = 1): string {
  const value = fromKg(kg, unit)
  if (Math.abs(value) < 0.05)
    return (0).toFixed(digits)
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}`
}

export function formatSignedWithUnit(kg: number, unit: Unit, digits = 1): string {
  return `${formatSigned(kg, unit, digits)} ${unitSuffix(unit)}`
}

export type WeightTone = 'loss' | 'gain' | 'flat'

export function toneOf(value: number): WeightTone {
  // Below the displayed precision a difference is a rounded zero, not a gain.
  if (value < -0.05)
    return 'loss'
  if (value > 0.05)
    return 'gain'
  return 'flat'
}

function normalizeWeighIn(value: unknown): WeighIn | undefined {
  if (!value || typeof value !== 'object')
    return undefined
  const item = value as Record<string, unknown>
  const weight = typeof item.weight === 'number' ? item.weight : Number.NaN
  if (!Number.isFinite(weight) || weight < WEIGHT_MIN_KG || weight > WEIGHT_MAX_KG)
    return undefined
  return {
    weight: roundWeight(weight),
    at: isValidTime(item.at) ? item.at : new Date().toISOString(),
  }
}

function noteOf(value: unknown): string | undefined {
  if (typeof value !== 'string')
    return undefined
  const note = value.trim().slice(0, 500)
  return note || undefined
}

function normalizeRecord(key: string, value: unknown): DayRecord | undefined {
  if (!isDateKey(key) || !value || typeof value !== 'object')
    return undefined
  const item = value as Record<string, unknown>
  if (item.deleted === true)
    return undefined
  const morning = normalizeWeighIn(item.morning)
  const evening = normalizeWeighIn(item.evening)
  const note = noteOf(item.note)
  if (!morning && !evening && !note)
    return undefined
  return {
    date: key,
    ...(morning ? { morning } : {}),
    ...(evening ? { evening } : {}),
    ...(note ? { note } : {}),
    updatedAt: typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now(),
  }
}

/** Turns whatever was in storage (or an old version) into a state the app can use. */
export function normalizeState(raw: unknown): JournalState {
  const base = emptyState()
  if (!raw || typeof raw !== 'object')
    return base

  const value = raw as Record<string, unknown>
  const records: Record<string, DayRecord> = {}
  if (value.records && typeof value.records === 'object' && !Array.isArray(value.records)) {
    for (const [key, item] of Object.entries(value.records as Record<string, unknown>)) {
      const record = normalizeRecord(key, item)
      if (record)
        records[key] = record
    }
  }

  return {
    version: 1,
    unit: value.unit === 'jin' ? 'jin' : 'kg',
    records,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : base.createdAt,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : base.updatedAt,
  }
}

function setWeighIn(record: DayRecord, period: 'morning' | 'evening', kg: number | null): void {
  if (kg === null) {
    delete record[period]
    return
  }
  const current = record[period]
  const weight = roundWeight(Math.min(WEIGHT_MAX_KG, Math.max(WEIGHT_MIN_KG, kg)))
  if (current && Math.abs(current.weight - weight) < 0.001)
    return
  record[period] = { weight, at: new Date().toISOString() }
}

/** Writes both weigh-ins and the note for one day; a day with no data is removed. */
export function saveDay(
  state: JournalState,
  date: string,
  morningKg: number | null,
  eveningKg: number | null,
  note: string,
): void {
  if (!isDateKey(date))
    return

  const existing = state.records[date]
  const next: DayRecord = existing ? { ...existing } : { date, updatedAt: 0 }
  setWeighIn(next, 'morning', morningKg)
  setWeighIn(next, 'evening', eveningKg)

  const cleanNote = note.trim().slice(0, 500)
  if (cleanNote)
    next.note = cleanNote
  else
    delete next.note

  const now = Date.now()
  if (!next.morning && !next.evening && !next.note) {
    delete state.records[date]
    state.updatedAt = now
    return
  }

  next.updatedAt = now
  state.records[date] = next
  state.updatedAt = now
}

export function deleteDay(state: JournalState, date: string): void {
  if (!state.records[date])
    return
  delete state.records[date]
  state.updatedAt = Date.now()
}

export function clearAllDays(state: JournalState): void {
  state.records = {}
  state.updatedAt = Date.now()
}

export function nightChange(state: JournalState, date: string): NightChange | null {
  const morning = state.records[date]?.morning
  const evening = state.records[addDays(date, -1)]?.evening
  if (!morning || !evening)
    return null
  return {
    value: roundWeight(morning.weight - evening.weight),
    date,
    evening,
    morning,
  }
}

/** The most recent morning before `date`, skipping days that were never recorded. */
export function previousMorning(state: JournalState, date: string): { date: string, weighIn: WeighIn } | null {
  const earlier = Object.keys(state.records)
    .filter(key => key < date && state.records[key]?.morning)
    .sort()
  const key = earlier.at(-1)
  if (!key)
    return null
  const weighIn = state.records[key]?.morning
  return weighIn ? { date: key, weighIn } : null
}

export function dailyChange(state: JournalState, date: string): DailyChange | null {
  const morning = state.records[date]?.morning
  const previous = previousMorning(state, date)
  if (!morning || !previous)
    return null
  return {
    value: roundWeight(morning.weight - previous.weighIn.weight),
    date,
    from: previous.date,
    morning,
    previous: previous.weighIn,
  }
}

export function dayViews(state: JournalState): DayView[] {
  return Object.values(state.records)
    .sort((left, right) => left.date < right.date ? 1 : left.date > right.date ? -1 : 0)
    .map(record => ({
      date: record.date,
      ...(record.morning ? { morning: record.morning } : {}),
      ...(record.evening ? { evening: record.evening } : {}),
      ...(record.note ? { note: record.note } : {}),
      night: nightChange(state, record.date),
      change: dailyChange(state, record.date),
    }))
}

export function averageMorning(state: JournalState, from: string, to: string): number | null {
  const values = Object.values(state.records)
    .filter(record => record.date >= from && record.date <= to && record.morning)
    .map(record => record.morning!.weight)
  if (values.length === 0)
    return null
  return roundWeight(values.reduce((sum, value) => sum + value, 0) / values.length)
}

export function averageNightChange(state: JournalState, from: string, to: string): number | null {
  const values: number[] = []
  for (const record of Object.values(state.records)) {
    if (record.date < from || record.date > to)
      continue
    const night = nightChange(state, record.date)
    if (night)
      values.push(night.value)
  }
  if (values.length === 0)
    return null
  return roundWeight(values.reduce((sum, value) => sum + value, 0) / values.length)
}

export interface ExportFile {
  app: 'com.acefu.weight-journal'
  version: 1
  exportedAt: string
  unit: Unit
  records: DayRecord[]
}

export function exportFile(state: JournalState): ExportFile {
  return {
    app: 'com.acefu.weight-journal',
    version: 1,
    exportedAt: new Date().toISOString(),
    unit: state.unit,
    records: Object.values(state.records).sort((left, right) => left.date.localeCompare(right.date)),
  }
}

/** Merges a backup into the current state, keeping the newer version of each day. */
export function importFile(state: JournalState, raw: unknown): number {
  if (!raw || typeof raw !== 'object')
    throw new Error('不是有效的 JSON 备份')
  const value = raw as Record<string, unknown>
  if (value.unit === 'kg' || value.unit === 'jin')
    state.unit = value.unit

  let entries: unknown[] = []
  if (Array.isArray(value.records)) {
    entries = value.records
  }
  else if (value.records && typeof value.records === 'object') {
    entries = Object.entries(value.records as Record<string, unknown>).map(([date, record]) => {
      if (!record || typeof record !== 'object')
        return record
      return { date, ...(record as Record<string, unknown>) }
    })
  }
  else {
    throw new Error('备份里没有 records')
  }

  const now = Date.now()
  let changed = 0
  for (const [index, item] of entries.entries()) {
    if (!item || typeof item !== 'object')
      continue
    const record = item as Record<string, unknown>
    const date = typeof record.date === 'string' ? record.date : ''
    const updatedAt = typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
      ? record.updatedAt
      : now + index
    const normalized = normalizeRecord(date, { ...record, updatedAt })
    if (!normalized)
      continue
    const local = state.records[date]
    if (local && local.updatedAt >= normalized.updatedAt)
      continue
    state.records[date] = normalized
    changed += 1
  }
  state.updatedAt = now
  return changed
}

export function rangeKeys(state: JournalState, end: string, range: '7' | '30' | '90' | 'all'): string[] {
  if (range !== 'all')
    return rangeEndingAt(end, Number(range))

  const dates = Object.values(state.records)
    .filter(record => record.morning || record.evening)
    .map(record => record.date)
    .sort()
  const first = dates[0] ?? addDays(end, -6)
  const count = Math.min(366, Math.max(7, daysBetween(first, end) + 1))
  return rangeEndingAt(end, count)
}
