<script setup lang="ts">
import type { LineSeries } from '../types'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  labels: string[]
  mode: 'line' | 'bar'
  series?: LineSeries[]
  bars?: (number | null)[]
  format: (value: number) => string
  suffix?: string
  height?: number
  label?: string
  zeroLine?: boolean
}>(), {
  series: () => [],
  bars: () => [],
  suffix: '',
  height: 200,
  label: '趋势图',
  zeroLine: false,
})

const host = ref<HTMLElement>()
const width = ref(640)
let observer: ResizeObserver | null = null

onMounted(() => {
  if (!host.value)
    return
  width.value = Math.max(280, host.value.clientWidth)
  observer = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry)
      width.value = Math.max(280, entry.contentRect.width)
  })
  observer.observe(host.value)
})

onBeforeUnmount(() => observer?.disconnect())

const pad = { top: 14, right: 10, bottom: 26, left: 42 }
const n = computed(() => props.labels.length)
const plotW = computed(() => Math.max(20, width.value - pad.left - pad.right))
const plotH = computed(() => Math.max(30, props.height - pad.top - pad.bottom))

const allValues = computed(() => {
  const values: number[] = []
  for (const series of props.series) {
    for (const value of series.values) {
      if (value != null && Number.isFinite(value))
        values.push(value)
    }
  }
  for (const value of props.bars) {
    if (value != null && Number.isFinite(value))
      values.push(value)
  }
  return values
})

const hasData = computed(() => allValues.value.length > 0)

function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0)
    return 1
  const power = 10 ** Math.floor(Math.log10(raw))
  const fraction = raw / power
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return nice * power
}

const domain = computed(() => {
  const values = allValues.value
  if (values.length === 0)
    return { min: 0, max: 1, step: 1 }

  let min = Math.min(...values)
  let max = Math.max(...values)
  if (props.mode === 'bar' || props.zeroLine) {
    min = Math.min(min, 0)
    max = Math.max(max, 0)
  }
  if (min === max) {
    min -= 1
    max += 1
  }
  if (props.mode === 'line') {
    const padding = (max - min) * 0.08
    min -= padding
    max += padding
  }

  const step = niceStep((max - min) / 4)
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  return {
    min: Math.round(lo * 1000) / 1000,
    max: Math.round((hi === lo ? lo + step : hi) * 1000) / 1000,
    step,
  }
})

const ticks = computed(() => {
  const { min, max, step } = domain.value
  const values: number[] = []
  for (let value = min; value <= max + step / 2 && values.length < 10; value += step)
    values.push(Math.round(value * 1000) / 1000)
  return values
})

function x(index: number): number {
  if (n.value <= 1)
    return pad.left + plotW.value / 2
  if (props.mode === 'bar')
    return pad.left + ((index + 0.5) / n.value) * plotW.value
  return pad.left + (index / (n.value - 1)) * plotW.value
}

function y(value: number): number {
  const { min, max } = domain.value
  const ratio = (value - min) / (max - min || 1)
  return pad.top + (1 - ratio) * plotH.value
}

const lines = computed(() => {
  return props.series.map((series) => {
    const points: { i: number, x: number, y: number, value: number }[] = []
    const paths: string[] = []
    let run: string[] = []

    for (let index = 0; index < n.value; index += 1) {
      const value = series.values[index]
      if (value == null || !Number.isFinite(value)) {
        if (run.length > 0) {
          paths.push(run.join(' '))
          run = []
        }
        continue
      }
      const px = x(index)
      const py = y(value)
      points.push({ i: index, x: px, y: py, value })
      run.push(`${run.length === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`)
    }
    if (run.length > 0)
      paths.push(run.join(' '))

    return { ...series, points, paths }
  })
})

const barWidth = computed(() => Math.max(3, Math.min(22, (plotW.value / Math.max(1, n.value)) * 0.62)))

const renderedBars = computed(() => {
  const zero = y(0)
  return props.bars.map((value, index) => {
    if (value == null || !Number.isFinite(value))
      return null
    const py = y(value)
    return {
      i: index,
      x: x(index) - barWidth.value / 2,
      y: Math.min(py, zero),
      width: barWidth.value,
      height: Math.max(1.5, Math.abs(py - zero)),
      value,
      fill: value < 0 ? 'var(--success)' : value > 0 ? 'var(--warning)' : 'var(--text-muted)',
    }
  }).filter((bar): bar is NonNullable<typeof bar> => bar !== null)
})

const labelIndices = computed(() => {
  if (n.value <= 1)
    return [0]
  const step = Math.max(1, Math.ceil((n.value - 1) / 4))
  const indices: number[] = []
  for (let index = 0; index < n.value; index += step)
    indices.push(index)
  const last = n.value - 1
  if (indices.at(-1) !== last)
    indices.push(last)
  return indices
})

const showDots = computed(() => n.value <= 45)

const hoverIndex = ref<number | null>(null)

const hoverX = computed(() => hoverIndex.value === null ? 0 : x(hoverIndex.value))

const hoverDots = computed(() => {
  if (hoverIndex.value === null || props.mode !== 'line')
    return []
  return lines.value.flatMap((line) => {
    const point = line.points.find(item => item.i === hoverIndex.value)
    return point ? [{ ...point, color: line.color }] : []
  })
})

const tooltipLeft = computed(() => {
  if (hoverIndex.value === null)
    return 0
  const margin = 78
  return Math.min(Math.max(margin, hoverX.value), Math.max(margin, width.value - margin))
})

const tooltipRows = computed(() => {
  const index = hoverIndex.value
  if (index === null)
    return []
  if (props.mode === 'bar') {
    const value = props.bars[index]
    return value == null ? [] : [{ label: '数值', value: `${props.format(value)} ${props.suffix}`.trim(), color: value < 0 ? 'var(--success)' : 'var(--warning)' }]
  }
  return props.series
    .filter(series => series.values[index] != null)
    .map(series => ({
      label: series.label,
      value: `${props.format(series.values[index]!)} ${props.suffix}`.trim(),
      color: series.color,
    }))
})

function onMove(event: PointerEvent): void {
  if (n.value === 0)
    return
  const rect = (event.currentTarget as SVGRectElement).getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)))
  const index = props.mode === 'line'
    ? Math.round(ratio * (n.value - 1))
    : Math.min(n.value - 1, Math.floor(ratio * n.value))
  hoverIndex.value = index
}

const ariaLabel = computed(() => `${props.label}，共 ${n.value} 天${hasData.value ? '' : '，暂无数据'}`)
</script>

<template>
  <div ref="host" class="chart" :style="{ height: `${props.height}px` }">
    <svg
      v-if="hasData"
      :width="width"
      :height="props.height"
      :viewBox="`0 0 ${width} ${props.height}`"
      role="img"
      :aria-label="ariaLabel"
    >
      <g class="grid">
        <line
          v-for="tick in ticks"
          :key="`grid-${tick}`"
          :x1="pad.left"
          :x2="width - pad.right"
          :y1="y(tick)"
          :y2="y(tick)"
        />
        <text
          v-for="tick in ticks"
          :key="`tick-${tick}`"
          :x="pad.left - 7"
          :y="y(tick) + 3.5"
          text-anchor="end"
        >
          {{ props.format(tick) }}
        </text>
      </g>

      <line
        v-if="props.mode === 'bar'"
        class="zero"
        :x1="pad.left"
        :x2="width - pad.right"
        :y1="y(0)"
        :y2="y(0)"
      />

      <template v-if="props.mode === 'line'">
        <g v-for="line in lines" :key="`paths-${line.id}`">
          <path
            v-for="(path, index) in line.paths"
            :key="`${line.id}-${index}`"
            :d="path"
            fill="none"
            :stroke="line.color"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            :stroke-dasharray="line.dashed ? '5 4' : undefined"
          />
        </g>
        <g v-if="showDots">
          <template v-for="line in lines" :key="`dots-${line.id}`">
            <circle
              v-for="point in line.points"
              :key="`${line.id}-${point.i}`"
              :cx="point.x"
              :cy="point.y"
              r="2.6"
              :fill="line.color"
            />
          </template>
        </g>
        <circle
          v-for="dot in hoverDots"
          :key="`hover-${dot.i}-${dot.color}`"
          :cx="dot.x"
          :cy="dot.y"
          r="4.5"
          :fill="dot.color"
          stroke="var(--surface)"
          stroke-width="2"
        />
      </template>

      <g v-else>
        <rect
          v-for="bar in renderedBars"
          :key="`bar-${bar.i}`"
          :x="bar.x"
          :y="bar.y"
          :width="bar.width"
          :height="bar.height"
          :fill="bar.fill"
          rx="3"
          opacity="0.9"
        />
      </g>

      <line
        v-if="hoverIndex !== null"
        class="guide"
        :x1="hoverX"
        :x2="hoverX"
        :y1="pad.top"
        :y2="pad.top + plotH"
      />

      <g class="labels">
        <text
          v-for="index in labelIndices"
          :key="`label-${index}`"
          :x="x(index)"
          :y="props.height - 7"
          :text-anchor="index === 0 && n > 1 ? 'start' : index === n - 1 && n > 1 ? 'end' : 'middle'"
        >
          {{ props.labels[index] }}
        </text>
      </g>

      <rect
        class="hit"
        :x="pad.left"
        :y="pad.top"
        :width="plotW"
        :height="plotH"
        @pointermove="onMove"
        @pointerleave="hoverIndex = null"
      />
    </svg>

    <div v-else class="chart-empty">
      还没有可画的数据
    </div>

    <div v-if="hoverIndex !== null && tooltipRows.length > 0" class="chart-tip" :style="{ left: `${tooltipLeft}px` }">
      <strong>{{ props.labels[hoverIndex] }}</strong>
      <div v-for="row in tooltipRows" :key="row.label" class="tip-row">
        <span class="tip-label">
          <i :style="{ background: row.color }" />
          {{ row.label }}
        </span>
        <span class="tip-value">{{ row.value }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart {
  position: relative;
  width: 100%;
  min-width: 0;
}

.chart svg {
  display: block;
  overflow: visible;
}

.grid line {
  stroke: var(--border-subtle);
  stroke-width: 1;
}

.grid text,
.labels text {
  fill: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.zero {
  stroke: var(--border-strong);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.guide {
  stroke: var(--border-strong);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.hit {
  fill: transparent;
  cursor: crosshair;
}

.chart-empty {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.chart-tip {
  position: absolute;
  top: 4px;
  z-index: 2;
  min-width: 96px;
  padding: 7px 9px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--elevated);
  box-shadow: var(--shadow-md);
  transform: translateX(-50%);
  pointer-events: none;
}

.chart-tip strong {
  display: block;
  margin-bottom: 4px;
  color: var(--text-secondary);
  font-size: var(--text-2xs);
  font-weight: 600;
}

.tip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  font-size: var(--text-xs);
  line-height: 1.7;
}

.tip-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-muted);
}

.tip-label i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.tip-value {
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
</style>
