<script setup lang="ts">
import type { JournalState, Unit } from '../types'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { addDays, formatDay, formatWeekday, todayKey } from '../lib/date'
import {
  formatInputWeight,
  formatSignedWithUnit,
  inputBounds,
  nightChange,
  toKg,
  toneOf,
  unitSuffix,
} from '../lib/journal'
import Modal from './Modal.vue'

const props = defineProps<{
  state: JournalState
  unit: Unit
  date: string
}>()

const emit = defineEmits<{
  close: []
  save: [date: string, morningKg: number | null, eveningKg: number | null, note: string]
  delete: [date: string]
}>()

const draftDate = ref(props.date)
const morningText = ref('')
const eveningText = ref('')
const note = ref('')
const error = ref('')
const confirmDelete = ref(false)
const morningInput = ref<HTMLInputElement>()

const existing = computed(() => {
  const record = props.state.records[draftDate.value]
  return record && !record.deleted ? record : undefined
})

function reset(): void {
  const record = existing.value
  morningText.value = record?.morning ? formatInputWeight(record.morning.weight, props.unit) : ''
  eveningText.value = record?.evening ? formatInputWeight(record.evening.weight, props.unit) : ''
  note.value = record?.note ?? ''
  error.value = ''
  confirmDelete.value = false
}

function focusMorning(): void {
  void nextTick(() => {
    morningInput.value?.focus()
    morningInput.value?.select()
  })
}

onMounted(() => {
  reset()
  focusMorning()
})

watch(() => props.date, (date) => {
  draftDate.value = date
  reset()
  focusMorning()
})

watch(draftDate, () => {
  reset()
  focusMorning()
})

watch(() => props.unit, () => reset())

function parseWeight(text: string): { kg: number | null, message: string } {
  const raw = text.trim().replace(',', '.')
  if (!raw)
    return { kg: null, message: '' }
  const value = Number(raw)
  if (!Number.isFinite(value))
    return { kg: null, message: '请输入数字' }
  const { min, max } = inputBounds(props.unit)
  if (value < min || value > max)
    return { kg: null, message: `请输入 ${min}–${max} ${unitSuffix(props.unit)}` }
  return { kg: toKg(value, props.unit), message: '' }
}

const draftNight = computed(() => {
  const morning = parseWeight(morningText.value).kg
  const previousEvening = props.state.records[addDays(draftDate.value, -1)]?.evening?.weight
  if (morning == null || previousEvening == null)
    return null
  return morning - previousEvening
})

const storedNight = computed(() => nightChange(props.state, draftDate.value))

function submit(): void {
  const morning = parseWeight(morningText.value)
  if (morning.message) {
    error.value = `早上：${morning.message}`
    return
  }
  const evening = parseWeight(eveningText.value)
  if (evening.message) {
    error.value = `晚上：${evening.message}`
    return
  }
  error.value = ''
  emit('save', draftDate.value, morning.kg, evening.kg, note.value)
}

function remove(): void {
  if (!confirmDelete.value) {
    confirmDelete.value = true
    return
  }
  emit('delete', draftDate.value)
}

function shift(days: number): void {
  draftDate.value = addDays(draftDate.value, days)
}

const today = todayKey()
</script>

<template>
  <Modal title="补记 / 编辑" :subtitle="`${formatDay(draftDate)} ${formatWeekday(draftDate)}`" @close="emit('close')">
    <div class="entry">
      <div class="date-nav">
        <button class="af-btn" data-variant="ghost" data-size="sm" type="button" aria-label="前一天" @click="shift(-1)">
          ←
        </button>
        <input v-model="draftDate" class="af-input date-input" type="date" :max="today">
        <button class="af-btn" data-variant="ghost" data-size="sm" type="button" aria-label="后一天" :disabled="draftDate >= today" @click="shift(1)">
          →
        </button>
      </div>

      <div class="fields">
        <label class="field">
          <span class="af-label">早上 <em>{{ formatDay(draftDate) }}起床后</em></span>
          <span class="input-wrap">
            <input
              ref="morningInput"
              v-model="morningText"
              class="af-input weight-input"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              placeholder="—"
              @input="error = ''"
            >
            <span class="suffix">{{ unitSuffix(props.unit) }}</span>
          </span>
        </label>

        <label class="field">
          <span class="af-label">晚上 <em>{{ formatDay(draftDate) }}睡前</em></span>
          <span class="input-wrap">
            <input
              v-model="eveningText"
              class="af-input weight-input"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              placeholder="—"
              @input="error = ''"
            >
            <span class="suffix">{{ unitSuffix(props.unit) }}</span>
          </span>
        </label>
      </div>

      <p v-if="draftNight !== null" class="night-preview" :data-tone="toneOf(draftNight)">
        这一夜（{{ formatDay(addDays(draftDate, -1)) }}晚 → {{ formatDay(draftDate) }}早）
        <strong>{{ formatSignedWithUnit(draftNight, props.unit) }}</strong>
      </p>
      <p v-else-if="storedNight" class="night-preview" :data-tone="toneOf(storedNight.value)">
        已记录的这一夜
        <strong>{{ formatSignedWithUnit(storedNight.value, props.unit) }}</strong>
      </p>
      <p v-else class="night-preview muted">
        上一晚的睡前体重还没记录；补上后，这一夜就会自动算出来。
      </p>

      <label class="field">
        <span class="af-label">备注 <em>可选</em></span>
        <textarea v-model="note" class="af-textarea" rows="2" maxlength="500" placeholder="饮食、运动、睡眠……" />
      </label>

      <p v-if="error" class="form-error">{{ error }}</p>
    </div>

    <template #footer>
      <button
        v-if="existing"
        class="af-btn delete-btn"
        data-variant="danger"
        data-size="sm"
        type="button"
        @click="remove"
      >
        {{ confirmDelete ? '再点一次确认删除' : '删除这一天' }}
      </button>
      <button class="af-btn" data-size="sm" type="button" @click="emit('close')">
        取消
      </button>
      <button class="af-btn" data-variant="primary" data-size="sm" type="button" @click="submit">
        保存
      </button>
    </template>
  </Modal>
</template>

<style scoped>
.entry {
  display: grid;
  gap: var(--space-4);
}

.date-nav {
  display: grid;
  grid-template-columns: 30px 1fr 30px;
  align-items: center;
  gap: var(--space-2);
}

.date-input {
  height: 30px;
  text-align: center;
}

.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

@media (max-width: 460px) {
  .fields {
    grid-template-columns: 1fr;
  }
}

.field {
  display: grid;
  gap: 6px;
}

.field em {
  color: var(--text-muted);
  font-style: normal;
  font-weight: 400;
}

.input-wrap {
  position: relative;
  display: block;
}

.weight-input {
  height: 42px;
  padding-right: 38px;
  font-size: 19px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.suffix {
  position: absolute;
  top: 50%;
  right: 11px;
  color: var(--text-muted);
  font-size: var(--text-sm);
  transform: translateY(-50%);
}

.night-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin: 0;
  padding: 8px 11px;
  border-radius: var(--radius-md);
  background: var(--sunken);
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.night-preview[data-tone='loss'] strong {
  color: var(--success);
}

.night-preview[data-tone='gain'] strong {
  color: var(--warning);
}

.night-preview.muted {
  color: var(--text-muted);
}

.form-error {
  margin: 0;
  color: var(--danger);
  font-size: var(--text-sm);
}

.delete-btn {
  margin-right: auto;
}
</style>
