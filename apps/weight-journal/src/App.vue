<script setup lang="ts">
import type { AcefuApi, AppInfo } from '@acefu-lab/app-kit'
import type { ChartMode, ChartRange, JournalState, LineSeries, Unit } from './types'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import DayList from './components/DayList.vue'
import EntryDialog from './components/EntryDialog.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import StatCard from './components/StatCard.vue'
import TrendChart from './components/TrendChart.vue'
import WeighCard from './components/WeighCard.vue'
import { addDays, formatDay, formatFullDay, formatShort, todayKey } from './lib/date'
import {
  STORAGE_KEY,
  averageMorning,
  averageNightChange,
  clearAllDays,
  dailyChange,
  dayViews,
  deleteDay,
  emptyState,
  exportFile,
  formatSigned,
  formatSignedWithUnit,
  formatWeight,
  importFile,
  nightChange,
  normalizeState,
  rangeKeys,
  saveDay,
  toneOf,
  unitName,
  unitSuffix,
} from './lib/journal'

const props = defineProps<{
  api: AcefuApi
  info: AppInfo
}>()

const journal = ref<JournalState>(emptyState())
const loading = ref(true)
const loadError = ref('')
const editDate = ref<string | null>(null)
const settingsOpen = ref(false)
const today = ref(todayKey())
const toast = ref<{ text: string, tone: 'ok' | 'error' } | null>(null)

let toastTimer: number | undefined
let dayTimer: number | undefined
let writeQueue: Promise<void> = Promise.resolve()

const unit = computed(() => journal.value.unit)
const yesterday = computed(() => addDays(today.value, -1))
const yesterdayEvening = computed(() => journal.value.records[yesterday.value]?.evening)
const thisMorning = computed(() => journal.value.records[today.value]?.morning)
const tonightEvening = computed(() => journal.value.records[today.value]?.evening)
const lastNight = computed(() => nightChange(journal.value, today.value))
const todayChange = computed(() => dailyChange(journal.value, today.value))
const sevenAverage = computed(() => averageMorning(journal.value, addDays(today.value, -6), today.value))
const sevenNightAverage = computed(() => averageNightChange(journal.value, addDays(today.value, -6), today.value))
const sevenCount = computed(() => {
  const from = addDays(today.value, -6)
  return Object.values(journal.value.records)
    .filter(record => record.date >= from && record.date <= today.value && record.morning)
    .length
})
const days = computed(() => dayViews(journal.value))

function describe(cause: unknown): string {
  if (cause && typeof cause === 'object') {
    const value = cause as { code?: unknown, message?: unknown }
    if (value.code === 'EDENIED')
      return '没有获得相应权限（请在系统提示中允许）'
    if (typeof value.message === 'string' && value.message)
      return value.message
  }
  return String(cause)
}

function cloneState(): JournalState {
  return JSON.parse(JSON.stringify(journal.value)) as JournalState
}

function showToast(text: string, tone: 'ok' | 'error' = 'ok'): void {
  toast.value = { text, tone }
  if (toastTimer)
    window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 2800)
}

function persist(): Promise<void> {
  const snapshot = cloneState()
  writeQueue = writeQueue.then(async () => {
    await props.api.storage.set(STORAGE_KEY, snapshot)
  }).catch((cause) => {
    showToast(`保存失败：${describe(cause)}`, 'error')
  })
  return writeQueue
}

function commit(next: JournalState): void {
  journal.value = next
  void persist()
}

function saveSingle(date: string, period: 'morning' | 'evening', kg: number | null): void {
  const next = cloneState()
  const existing = next.records[date]
  saveDay(
    next,
    date,
    period === 'morning' ? kg : existing?.morning?.weight ?? null,
    period === 'evening' ? kg : existing?.evening?.weight ?? null,
    existing?.note ?? '',
  )
  commit(next)
  showToast(kg === null ? '已清除这次记录' : '已记录')
}

function saveFromDialog(date: string, morning: number | null, evening: number | null, note: string): void {
  const next = cloneState()
  saveDay(next, date, morning, evening, note)
  commit(next)
  editDate.value = null
  showToast('已保存')
}

function deleteFromDialog(date: string): void {
  const next = cloneState()
  deleteDay(next, date)
  commit(next)
  editDate.value = null
  showToast('已删除这一天的记录')
}

function clearAll(): void {
  const next = cloneState()
  clearAllDays(next)
  commit(next)
  showToast('已清空所有记录')
}

function setUnit(nextUnit: Unit): void {
  if (journal.value.unit === nextUnit)
    return
  const next = cloneState()
  next.unit = nextUnit
  next.updatedAt = Date.now()
  journal.value = next
  void persist()
}

function openEntry(date: string): void {
  editDate.value = date
}

function openSettings(): void {
  settingsOpen.value = true
}

function exportJson(): void {
  const data = JSON.stringify(exportFile(journal.value), null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `weight-journal-${today.value}.json`
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  showToast('已导出 JSON；如果没有弹出保存框，请用“复制 JSON”')
}

async function copyJson(): Promise<void> {
  try {
    await props.api.clipboard.writeText(JSON.stringify(exportFile(journal.value), null, 2))
    showToast('JSON 已复制到剪贴板')
  }
  catch (cause) {
    showToast(`复制失败：${describe(cause)}`, 'error')
  }
}

function importJson(raw: unknown): void {
  try {
    const next = cloneState()
    const count = importFile(next, raw)
    commit(next)
    showToast(count > 0 ? `导入完成，更新了 ${count} 天` : '导入完成，没有更新的记录')
  }
  catch (cause) {
    showToast(`导入失败：${describe(cause)}`, 'error')
  }
}

const nightStat = computed(() => {
  const night = lastNight.value
  if (!night)
    return { value: '—', unit: '', detail: '还差一次记录', tone: 'neutral' as const }
  return {
    value: formatSigned(night.value, unit.value),
    unit: unitSuffix(unit.value),
    detail: `${formatWeight(night.evening.weight, unit.value)} → ${formatWeight(night.morning.weight, unit.value)}`,
    tone: toneFor(night.value),
  }
})

const dayStat = computed(() => {
  const change = todayChange.value
  if (!change)
    return { value: '—', unit: '', detail: '需要今天和上一次早上的记录', tone: 'neutral' as const }
  return {
    value: formatSigned(change.value, unit.value),
    unit: unitSuffix(unit.value),
    detail: `较 ${formatDay(change.from)} 早上`,
    tone: toneFor(change.value),
  }
})

const avgStat = computed(() => {
  const average = sevenAverage.value
  if (average === null)
    return { value: '—', unit: '', detail: '最近 7 天还没有早上记录', tone: 'neutral' as const }
  const night = sevenNightAverage.value
  return {
    value: formatWeight(average, unit.value),
    unit: unitSuffix(unit.value),
    detail: `最近 7 天 · ${sevenCount.value} 次${night === null ? '' : ` · 夜间均 ${formatSignedWithUnit(night, unit.value)}`}`,
    tone: 'neutral' as const,
  }
})

function toneFor(value: number): 'neutral' | 'loss' | 'gain' {
  const tone = toneOf(value)
  return tone === 'flat' ? 'neutral' : tone
}

const nightSummary = computed(() => {
  const night = lastNight.value
  if (night)
    return { text: `睡前 ${formatWeight(night.evening.weight, unit.value)} → 起床 ${formatWeight(night.morning.weight, unit.value)}`, tone: toneFor(night.value) }
  if (!yesterdayEvening.value && thisMorning.value)
    return { text: '补上昨晚的体重，这一夜就能算出来', tone: 'neutral' as const }
  if (yesterdayEvening.value && !thisMorning.value)
    return { text: '记录今早的体重，这一夜就能算出来', tone: 'neutral' as const }
  return { text: '记录昨晚和今早，自动算出一夜代谢', tone: 'neutral' as const }
})

const chartRange = ref<ChartRange>('30')
const chartMode = ref<ChartMode>('weight')
const ranges = [
  { value: '7', label: '7 天' },
  { value: '30', label: '30 天' },
  { value: '90', label: '90 天' },
  { value: 'all', label: '全部' },
] as const

const chartKeys = computed(() => rangeKeys(journal.value, today.value, chartRange.value))
const chartLabels = computed(() => chartKeys.value.map(formatShort))

const weightSeries = computed<LineSeries[]>(() => {
  const records = journal.value.records
  return [
    {
      id: 'morning',
      label: '早上',
      color: 'var(--accent-500)',
      values: chartKeys.value.map(key => records[key]?.morning?.weight ?? null),
    },
    {
      id: 'evening',
      label: '晚上',
      color: 'var(--text-muted)',
      values: chartKeys.value.map(key => records[key]?.evening?.weight ?? null),
      dashed: true,
    },
  ]
})

const nightValues = computed(() => chartKeys.value.map(key => nightChange(journal.value, key)?.value ?? null))
const changeValues = computed(() => chartKeys.value.map(key => dailyChange(journal.value, key)?.value ?? null))

const chart = computed(() => {
  if (chartMode.value === 'weight') {
    return {
      mode: 'line' as const,
      series: weightSeries.value,
      bars: [] as (number | null)[],
      format: (value: number) => formatWeight(value, unit.value),
      title: '体重趋势',
      note: `实线是早上，虚线是晚上；单位 ${unitName(unit.value)}。`,
    }
  }

  const isNight = chartMode.value === 'night'
  return {
    mode: 'bar' as const,
    series: [] as LineSeries[],
    bars: isNight ? nightValues.value : changeValues.value,
    format: (value: number) => formatSigned(value, unit.value),
    title: isNight ? '夜间代谢' : '日变化',
    note: isNight
      ? '每晚睡前 → 次晨起床的体重差；负值表示下降。'
      : '每天早上与上一个有记录的早上相比；负值表示下降。',
  }
})

onMounted(async () => {
  try {
    journal.value = normalizeState(await props.api.storage.get<unknown>(STORAGE_KEY))
  }
  catch (cause) {
    loadError.value = describe(cause)
  }
  finally {
    loading.value = false
  }

  dayTimer = window.setInterval(() => {
    const current = todayKey()
    if (current !== today.value)
      today.value = current
  }, 60_000)
})

onBeforeUnmount(() => {
  if (toastTimer)
    window.clearTimeout(toastTimer)
  if (dayTimer)
    window.clearInterval(dayTimer)
})
</script>

<template>
  <div v-if="loading" class="boot">
    <span class="af-spinner" />
    <p>正在载入…</p>
  </div>

  <div v-else class="app" :inert="Boolean(editDate || settingsOpen)">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="17" height="17">
            <rect x="3.2" y="4.2" width="17.6" height="15.6" rx="3.4" fill="none" stroke="currentColor" stroke-width="1.5" />
            <path d="M8.4 9.2a4.2 4.2 0 0 1 7.2 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            <path d="M12 9.2l2.6-2.1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            <path d="M6.4 16.4c1.8 0 2.4-3.2 4.1-3.2s2.3 3.2 4 3.2 2.2-2.2 3.6-2.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          </svg>
        </span>
        <span>体重日记</span>
      </div>
      <div class="top-actions">
        <span class="local-pill" title="数据只保存在这台电脑">
          <span class="local-dot" />
          本地保存
        </span>
        <button class="af-btn" data-size="sm" type="button" @click="openSettings">
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" stroke-width="1.4" />
            <path d="M8 1.6v1.5M8 12.9v1.5M1.6 8h1.5M12.9 8h1.5M3.5 3.5l1.1 1.1M11.4 11.4l1.1 1.1M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          </svg>
          设置
        </button>
      </div>
    </header>

    <main class="page">
      <p v-if="loadError" class="notice">
        无法读取本机数据：{{ loadError }}。这次仍可使用，但关闭后可能丢失。
      </p>

      <section class="hero">
        <div class="hero-head">
          <div>
            <p class="eyebrow">今天</p>
            <h1>{{ formatFullDay(today) }}</h1>
          </div>
          <p class="hero-note">晚上睡前称一次，第二天起床再称一次。</p>
        </div>

        <div class="night-pair">
          <WeighCard
            label="昨晚"
            :date-label="formatFullDay(yesterday)"
            :weigh-in="yesterdayEvening"
            :unit="unit"
            @save="kg => saveSingle(yesterday, 'evening', kg)"
          />
          <div class="pair-arrow" aria-hidden="true">
            <span>一夜</span>
            <svg viewBox="0 0 24 12" width="26" height="12">
              <path d="M1 6h20M17 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <WeighCard
            label="今早"
            :date-label="formatFullDay(today)"
            :weigh-in="thisMorning"
            :unit="unit"
            @save="kg => saveSingle(today, 'morning', kg)"
          />
        </div>

        <div class="night-summary" :data-tone="nightSummary.tone">
          <div class="night-summary-main">
            <span>一夜代谢</span>
            <strong v-if="lastNight">{{ formatSignedWithUnit(lastNight.value, unit) }}</strong>
            <strong v-else>—</strong>
          </div>
          <span class="night-summary-detail">{{ nightSummary.text }}</span>
        </div>

        <div class="tonight">
          <WeighCard
            compact
            label="今晚"
            :date-label="formatFullDay(today)"
            :weigh-in="tonightEvening"
            :unit="unit"
            hint="睡前"
            @save="kg => saveSingle(today, 'evening', kg)"
          />
          <p class="tonight-hint">
            今晚记录后，明早再记一次，就会自动算成下一夜。
          </p>
        </div>
      </section>

      <section class="stats" aria-label="概览">
        <StatCard label="夜间代谢" :value="nightStat.value" :unit="nightStat.unit" :detail="nightStat.detail" :tone="nightStat.tone" />
        <StatCard label="日变化" :value="dayStat.value" :unit="dayStat.unit" :detail="dayStat.detail" :tone="dayStat.tone" />
        <StatCard label="7 日均重" :value="avgStat.value" :unit="avgStat.unit" :detail="avgStat.detail" :tone="avgStat.tone" />
      </section>

      <section class="card chart-card">
        <header class="card-head">
          <div>
            <h2>{{ chart.title }}</h2>
            <p>{{ chart.note }}</p>
          </div>
          <div class="af-segmented range-switch">
            <button
              v-for="option in ranges"
              :key="option.value"
              type="button"
              :data-state="chartRange === option.value ? 'on' : 'off'"
              @click="chartRange = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </header>

        <div class="af-segmented chart-tabs">
          <button type="button" :data-state="chartMode === 'weight' ? 'on' : 'off'" @click="chartMode = 'weight'">
            体重
          </button>
          <button type="button" :data-state="chartMode === 'night' ? 'on' : 'off'" @click="chartMode = 'night'">
            夜间代谢
          </button>
          <button type="button" :data-state="chartMode === 'change' ? 'on' : 'off'" @click="chartMode = 'change'">
            日变化
          </button>
        </div>

        <TrendChart
          :labels="chartLabels"
          :mode="chart.mode"
          :series="chart.series"
          :bars="chart.bars"
          :format="chart.format"
          :suffix="unitSuffix(unit)"
          :label="chart.title"
        />
      </section>

      <section class="card list-card">
        <header class="card-head">
          <div>
            <h2>最近记录</h2>
            <p>每天早上和晚上的数字，都在这里。</p>
          </div>
          <button class="af-btn" data-size="sm" type="button" @click="openEntry(today)">
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path d="M8 3.2v9.6M3.2 8h9.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
            补记
          </button>
        </header>
        <DayList :days="days" :unit="unit" @edit="openEntry" />
      </section>

      <footer class="foot">
        <span>{{ info.name }} v{{ info.version }} · 数据只保存在本机</span>
        <span>建议定期导出 JSON 备份</span>
      </footer>
    </main>
  </div>

  <EntryDialog
    v-if="editDate"
    :state="journal"
    :unit="unit"
    :date="editDate"
    @close="editDate = null"
    @save="saveFromDialog"
    @delete="deleteFromDialog"
  />

  <SettingsDialog
    v-if="settingsOpen"
    :state="journal"
    :unit="unit"
    :version="info.version"
    @close="settingsOpen = false"
    @update-unit="setUnit"
    @export-json="exportJson"
    @copy-json="copyJson"
    @import-json="importJson"
    @clear-all="clearAll"
  />

  <Transition name="toast">
    <div v-if="toast" class="toast" :data-tone="toast.tone">
      {{ toast.text }}
    </div>
  </Transition>
</template>

<style scoped>
.app {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.topbar {
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
  padding: 16px 22px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: var(--text-base);
  font-weight: 650;
  letter-spacing: 0.01em;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  border-radius: 9px;
  background: linear-gradient(145deg, #1f8a78, #0d5f55);
  color: #f2fbf8;
  box-shadow: 0 2px 6px rgba(13, 95, 85, 0.35);
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 7px;
}

.local-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  white-space: nowrap;
}

.local-pill:hover {
  background: var(--hover);
}

.local-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
}

.page {
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
  padding: 16px 22px 44px;
  display: grid;
  gap: 14px;
}

.notice {
  margin: 0;
  padding: 9px 12px;
  border: 1px solid color-mix(in srgb, var(--warning) 35%, transparent);
  border-radius: var(--radius-md);
  background: var(--warning-soft);
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.hero {
  padding: 16px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  background:
    radial-gradient(120% 140% at 0% 0%, var(--accent-softer), transparent 58%),
    var(--surface);
  box-shadow: var(--shadow-sm);
}

.hero-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: 500;
}

.hero h1 {
  margin: 1px 0 0;
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.015em;
}

.hero-note {
  max-width: 250px;
  margin: 3px 0 0;
  color: var(--text-muted);
  font-size: var(--text-sm);
  line-height: 1.5;
  text-align: right;
}

.night-pair {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 56px minmax(0, 1fr);
  align-items: stretch;
  gap: 4px;
  margin-top: 14px;
}

.pair-arrow {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 3px;
  color: var(--text-muted);
  font-size: var(--text-2xs);
}

.night-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  padding: 9px 12px;
  border-radius: var(--radius-md);
  background: var(--sunken);
}

.night-summary-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  white-space: nowrap;
}

.night-summary-main span {
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.night-summary-main strong {
  color: var(--text-primary);
  font-size: 17px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.night-summary[data-tone='loss'] .night-summary-main strong {
  color: var(--success);
}

.night-summary[data-tone='gain'] .night-summary-main strong {
  color: var(--warning);
}

.night-summary-detail {
  color: var(--text-muted);
  font-size: var(--text-xs);
  text-align: right;
}

.tonight {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr);
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}

.tonight-hint {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--text-xs);
  line-height: 1.55;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.card {
  padding: 14px 16px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.card-head h2 {
  margin: 0;
  font-size: var(--text-md);
  font-weight: 650;
  letter-spacing: -0.01em;
}

.card-head p {
  margin: 3px 0 0;
  color: var(--text-muted);
  font-size: var(--text-sm);
  line-height: 1.5;
}

.chart-card {
  display: grid;
  gap: 4px;
}

.range-switch {
  flex: none;
}

.chart-tabs {
  justify-self: start;
  margin: 8px 0 2px;
}

.list-card {
  padding-bottom: 10px;
}

.list-card .card-head {
  margin-bottom: 10px;
}

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 2px 3px;
  color: var(--text-muted);
  font-size: var(--text-xs);
  flex-wrap: wrap;
}

.boot {
  min-height: 100%;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 26px;
  z-index: 60;
  max-width: min(440px, calc(100vw - 32px));
  padding: 9px 14px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--elevated);
  color: var(--text-primary);
  box-shadow: var(--shadow-lg);
  font-size: var(--text-sm);
  transform: translateX(-50%);
}

.toast[data-tone='error'] {
  border-color: color-mix(in srgb, var(--danger) 40%, transparent);
  color: var(--danger);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

@media (max-width: 760px) {
  .stats {
    grid-template-columns: 1fr;
  }

  .hero-head {
    flex-direction: column;
    gap: 4px;
  }

  .hero-note {
    max-width: none;
    text-align: left;
  }
}

@media (max-width: 640px) {
  .topbar,
  .page {
    padding-left: 14px;
    padding-right: 14px;
  }

  .night-pair {
    grid-template-columns: 1fr;
    gap: 7px;
  }

  .pair-arrow {
    display: none;
  }

  .tonight {
    grid-template-columns: 1fr;
  }

  .night-summary {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }

  .night-summary-detail {
    text-align: left;
  }

  .card-head {
    flex-direction: column;
    gap: 8px;
  }

  .range-switch {
    align-self: flex-start;
  }
}
</style>
