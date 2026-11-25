<script setup lang="ts">
import type { JournalState, Unit } from '../types'
import { computed, ref } from 'vue'
import { unitName } from '../lib/journal'
import Modal from './Modal.vue'

const props = defineProps<{
  state: JournalState
  unit: Unit
  version: string
}>()

const emit = defineEmits<{
  close: []
  'update-unit': [unit: Unit]
  'export-json': []
  'copy-json': []
  'import-json': [raw: unknown]
  'clear-all': []
}>()

const message = ref<{ tone: 'ok' | 'error', text: string } | null>(null)
const confirmClear = ref(false)
const fileInput = ref<HTMLInputElement>()

const recordCount = computed(() => Object.values(props.state.records).length)

function pickFile(): void {
  fileInput.value?.click()
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file)
    return
  try {
    const raw = JSON.parse(await file.text()) as unknown
    message.value = null
    emit('import-json', raw)
  }
  catch {
    message.value = { tone: 'error', text: '这个文件不是有效的 JSON' }
  }
}

function clearAll(): void {
  if (!confirmClear.value) {
    confirmClear.value = true
    return
  }
  confirmClear.value = false
  emit('clear-all')
  message.value = { tone: 'ok', text: '记录已清空，JSON 备份不受影响' }
}
</script>

<template>
  <Modal title="设置" :subtitle="`体重日记 v${props.version}`" wide @close="emit('close')">
    <div class="settings">
      <section class="section">
        <div class="section-head">
          <h3>单位</h3>
          <p>只影响显示，数据始终按公斤保存。</p>
        </div>
        <div class="af-segmented unit-switch">
          <button type="button" :data-state="props.unit === 'kg' ? 'on' : 'off'" @click="emit('update-unit', 'kg')">
            公斤 kg
          </button>
          <button type="button" :data-state="props.unit === 'jin' ? 'on' : 'off'" @click="emit('update-unit', 'jin')">
            斤
          </button>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h3>数据</h3>
          <p>所有记录都只保存在这台电脑的 Acefu 应用数据里。换电脑或重装前，导出一份 JSON 备份；导入会按日期合并，保留更新的一份。</p>
        </div>
        <div class="actions">
          <button class="af-btn" data-size="sm" type="button" @click="emit('export-json')">
            导出 JSON
          </button>
          <button class="af-btn" data-size="sm" type="button" @click="emit('copy-json')">
            复制 JSON
          </button>
          <button class="af-btn" data-size="sm" type="button" @click="pickFile">
            导入 JSON
          </button>
          <button class="af-btn" data-variant="danger" data-size="sm" type="button" @click="clearAll">
            {{ confirmClear ? '再点一次确认清空' : '清空所有记录' }}
          </button>
          <input ref="fileInput" class="file-input" type="file" accept="application/json,.json" @change="onFile">
        </div>
        <p class="hint">导出文件没有反应时，用“复制 JSON”把内容存到别处。</p>
      </section>

      <p v-if="message" class="message" :data-tone="message.tone">
        {{ message.text }}
      </p>

      <section class="about">
        <span>当前单位：{{ unitName(props.unit) }}</span>
        <span>记录 {{ recordCount }} 天</span>
      </section>
    </div>

    <template #footer>
      <button class="af-btn" data-size="sm" type="button" @click="emit('close')">
        完成
      </button>
    </template>
  </Modal>
</template>

<style scoped>
.settings {
  display: grid;
  gap: var(--space-5);
}

.section {
  display: grid;
  gap: var(--space-3);
}

.section-head h3 {
  margin: 0 0 3px;
  font-size: var(--text-base);
  font-weight: 600;
}

.section-head p {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--text-sm);
  line-height: 1.55;
}

.unit-switch {
  justify-self: start;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}

.hint {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--text-xs);
  line-height: 1.5;
}

.file-input {
  display: none;
}

.message {
  margin: 0;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.message[data-tone='ok'] {
  background: var(--success-soft);
  color: var(--success);
}

.message[data-tone='error'] {
  background: var(--danger-soft);
  color: var(--danger);
}

.about {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: var(--text-xs);
}
</style>
