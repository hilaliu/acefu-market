/** One weigh-in, stored in kilograms regardless of the display unit. */
export interface WeighIn {
  weight: number
  /** ISO timestamp of when the number was recorded. */
  at: string
}

/** Everything recorded for one calendar day. */
export interface DayRecord {
  /** Local date key, `YYYY-MM-DD`. */
  date: string
  morning?: WeighIn
  evening?: WeighIn
  note?: string
  /** Milliseconds; used to keep the newer copy when an import is merged. */
  updatedAt: number
  /** Old backups may carry a tombstone; new records never write one. */
  deleted?: boolean
}

export type Unit = 'kg' | 'jin'

export interface JournalState {
  version: 1
  unit: Unit
  records: Record<string, DayRecord>
  createdAt: number
  updatedAt: number
}

export interface NightChange {
  /** Morning minus evening; negative means the weight went down overnight. */
  value: number
  date: string
  evening: WeighIn
  morning: WeighIn
}

export interface DailyChange {
  /** This morning minus the previous morning. */
  value: number
  date: string
  from: string
  morning: WeighIn
  previous: WeighIn
}

export interface DayView {
  date: string
  morning?: WeighIn
  evening?: WeighIn
  note?: string
  night: NightChange | null
  change: DailyChange | null
}

export interface LineSeries {
  id: string
  label: string
  color: string
  values: (number | null)[]
  dashed?: boolean
}

export type ChartMode = 'weight' | 'night' | 'change'
export type ChartRange = '7' | '30' | '90' | 'all'
