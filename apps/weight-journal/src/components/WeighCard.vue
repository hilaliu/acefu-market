<script setup lang="ts">
import type { WeighIn } from '../types'
import { computed, ref, watch } from 'vue'
import { formatClock } from '../lib/date'
import { formatInputWeight, inputBounds, toKg, unitSuffix } from '../lib/journal'

const props = withDefaults(defineProps<{
  label: string
  dateLabel: string
  weighIn?: WeighIn
  unit: 'kg' | 'jin'
  compact?: boolean
  hint?: string
}>(), { compact: false, hint: '' })

const emit = defineEmits<{ save: [weightKg: number | null] }>()

const text = ref(props.weighIn ? formatInputWeight(props.weighIn.weight, props.unit) : '')
const error = ref('')

watch(() => props.weighIn?.weight, (weight) => {
  text.value = weight === undefined ? '' : formatInputWeight(weight, props.unit)
  error.value = ''
})

watch(() => props.unit, (unit) => {
  text.value = props.weighIn ? formatInputWeight(props.weighIn.weight, unit) : ''
})

const dirty = computed(() => {
  const value = Number(text.value.trim().replace(',', '.'))
  if (!Number.isFinite(value))
    return text.value.trim().length > 0
  if (!props.weighIn)
    return true
  return Math.abs(props.weighIn.weight - toKg(value, props.unit)) > 0.005
})

function submit(): void {
  const raw = text.value.trim().replace(',', '.')
  if (!raw) {
    error.value = '请输入体重'
    return
  }
  const value = Number(raw)
  if (!Number.isFinite(value)) {
    error.value = '请输入数字'
    return
  }
  const { min, max } = inputBounds(props.unit)
  if (value < min || value > max) {
    error.value = `请输入 ${min}–${max} ${unitSuffix(props.unit)}`
    return
  }
  error.value = ''
  emit('save', toKg(value, props.unit))
}

function clear(): void {
  text.value = ''
  error.value = ''
  emit('save', null)
}
</script>

<template>
  <form class="weigh" :class="{ compact: props.compact, filled: Boolean(props.weighIn) }" @submit.prevent="submit">
    <div class="weigh-head">
      <span class="weigh-label">{{ props.label }}</span>
      <span class="weigh-date">{{ props.dateLabel }}</span>
    </div>
    <div class="weigh-row">
      <input
        v-model="text"
        class="weigh-input"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        :aria-label="`${props.label}体重`"
        :placeholder="props.hint || '—'"
        @input="error = ''"
      >
      <span class="weigh-unit">{{ unitSuffix(props.unit) }}</span>
      <button class="af-btn" :data-variant="dirty ? 'primary' : 'ghost'" data-size="sm" type="submit" :disabled="!text.trim() || !dirty">
        {{ dirty ? '保存' : '已记录' }}
      </button>
    </div>
    <div class="weigh-foot">
      <span v-if="error" class="weigh-error">{{ error }}</span>
      <span v-else-if="props.weighIn" class="weigh-ok">✓ {{ formatClock(props.weighIn.at) }} 记录</span>
      <span v-else class="weigh-muted">未记录</span>
      <button v-if="props.weighIn" class="weigh-clear" type="button" @click="clear">清除</button>
    </div>
  </form>
</template>

<style scoped>
.weigh {
  display: grid;
  gap: 7px;
  padding: 11px 12px 9px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--surface);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.weigh:focus-within {
  border-color: var(--accent-ring);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.weigh.filled {
  background: var(--elevated);
}

.weigh.compact {
  padding: 9px 11px 7px;
  border-style: dashed;
}

.weigh-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.weigh-label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.weigh-date {
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.weigh-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.weigh-input {
  flex: 1;
  min-width: 0;
  padding: 2px 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 30px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.weigh.compact .weigh-input {
  font-size: 24px;
}

.weigh-input::placeholder {
  color: var(--text-muted);
  font-weight: 400;
}

.weigh-unit {
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.weigh-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 16px;
  gap: 8px;
}

.weigh-ok,
.weigh-muted,
.weigh-error {
  font-size: var(--text-xs);
}

.weigh-ok {
  color: var(--success);
}

.weigh-muted {
  color: var(--text-muted);
}

.weigh-error {
  color: var(--danger);
}

.weigh-clear {
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.weigh-clear:hover {
  color: var(--danger);
}
</style>
