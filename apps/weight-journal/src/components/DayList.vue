<script setup lang="ts">
import type { DayView } from '../types'
import { computed, ref } from 'vue'
import { formatDay, formatWeekday, isToday } from '../lib/date'
import { formatSignedWithUnit, formatWeight, toneOf, unitSuffix } from '../lib/journal'

const props = withDefaults(defineProps<{
  days: DayView[]
  unit: 'kg' | 'jin'
  limit?: number
}>(), { limit: 12 })

const emit = defineEmits<{ edit: [date: string] }>()

const expanded = ref(false)
const shown = computed(() => expanded.value ? props.days : props.days.slice(0, props.limit))

function tone(value: number | null | undefined): string {
  return value == null ? 'flat' : toneOf(value)
}
</script>

<template>
  <div class="day-list">
    <div v-if="props.days.length === 0" class="day-empty">
      <p>还没有记录</p>
      <span>从今天早上或今晚开始，第一天就会出现在这里。</span>
    </div>

    <div v-for="day in shown" :key="day.date" class="day-row">
      <div class="day-date">
        <strong>{{ formatDay(day.date) }}</strong>
        <span>{{ formatWeekday(day.date) }}</span>
        <em v-if="isToday(day.date)">今天</em>
      </div>

      <div class="day-cell">
        <span class="cell-label">早上</span>
        <span class="cell-value" :class="{ empty: !day.morning }">
          {{ day.morning ? `${formatWeight(day.morning.weight, props.unit)} ${unitSuffix(props.unit)}` : '—' }}
        </span>
      </div>

      <div class="day-cell">
        <span class="cell-label">晚上</span>
        <span class="cell-value" :class="{ empty: !day.evening }">
          {{ day.evening ? `${formatWeight(day.evening.weight, props.unit)} ${unitSuffix(props.unit)}` : '—' }}
        </span>
      </div>

      <div class="day-cell">
        <span class="cell-label">夜间</span>
        <span v-if="day.night" class="cell-value" :data-tone="tone(day.night.value)">
          {{ formatSignedWithUnit(day.night.value, props.unit) }}
        </span>
        <span v-else class="cell-value empty">—</span>
      </div>

      <div class="day-cell">
        <span class="cell-label">日变化</span>
        <span v-if="day.change" class="cell-value" :data-tone="tone(day.change.value)">
          {{ formatSignedWithUnit(day.change.value, props.unit) }}
        </span>
        <span v-else class="cell-value empty">—</span>
      </div>

      <button class="day-edit af-icon-btn" type="button" :aria-label="`编辑 ${formatDay(day.date)}`" @click="emit('edit', day.date)">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M10.5 2.5l3 3L6 13H3v-3l7.5-7.5z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <button v-if="props.days.length > props.limit" class="day-more af-btn" data-variant="ghost" data-size="sm" type="button" @click="expanded = !expanded">
      {{ expanded ? '收起' : `显示全部 ${props.days.length} 天` }}
    </button>
  </div>
</template>

<style scoped>
.day-list {
  display: grid;
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--border-subtle);
}

.day-empty {
  display: grid;
  gap: 4px;
  padding: 26px 18px;
  background: var(--surface);
  text-align: center;
}

.day-empty p {
  margin: 0;
  font-weight: 600;
}

.day-empty span {
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.day-row {
  display: grid;
  grid-template-columns: 1.25fr repeat(4, minmax(0, 1fr)) 30px;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: var(--surface);
}

.day-row:hover {
  background: var(--hover);
}

.day-date {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
}

.day-date strong {
  font-size: var(--text-base);
  font-weight: 600;
  white-space: nowrap;
}

.day-date span {
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.day-date em {
  padding: 1px 5px;
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  color: var(--accent-600);
  font-size: var(--text-2xs);
  font-style: normal;
  white-space: nowrap;
}

.day-cell {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.cell-label {
  color: var(--text-muted);
  font-size: var(--text-2xs);
}

.cell-value {
  overflow: hidden;
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-value.empty {
  color: var(--text-muted);
}

.cell-value[data-tone='loss'] {
  color: var(--success);
}

.cell-value[data-tone='gain'] {
  color: var(--warning);
}

.day-edit {
  justify-self: end;
  opacity: 0.65;
}

.day-row:hover .day-edit {
  opacity: 1;
}

.day-more {
  justify-self: center;
  margin: 8px;
}

@media (max-width: 640px) {
  .day-row {
    grid-template-columns: 1.2fr repeat(2, 1fr) 30px;
  }

  .day-row .day-cell:nth-child(4),
  .day-row .day-cell:nth-child(5) {
    display: none;
  }
}
</style>
