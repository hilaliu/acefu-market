<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  wide?: boolean
}>(), { subtitle: '', wide: false })

const emit = defineEmits<{ close: [] }>()

const titleId = `dialog-title-${Math.random().toString(36).slice(2, 8)}`

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape')
    emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="emit('close')">
      <section class="modal" :class="{ wide: props.wide }" role="dialog" aria-modal="true" :aria-labelledby="titleId">
        <header class="modal-head">
          <div>
            <h2 :id="titleId">{{ props.title }}</h2>
            <p v-if="props.subtitle" class="modal-subtitle">{{ props.subtitle }}</p>
          </div>
          <button class="af-icon-btn" type="button" aria-label="关闭" @click="emit('close')">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </button>
        </header>
        <div class="modal-body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="modal-foot">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: var(--scrim);
  backdrop-filter: blur(2px);
}

.modal {
  width: 100%;
  max-width: 480px;
  max-height: min(86vh, 720px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}

.modal.wide {
  max-width: 620px;
}

.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
}

.modal-head h2 {
  margin: 0;
  font-size: var(--text-md);
  font-weight: 600;
}

.modal-subtitle {
  margin: 3px 0 0;
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.modal-body {
  padding: var(--space-4);
  overflow: auto;
}

.modal-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--border-subtle);
  background: var(--sunken);
}
</style>
