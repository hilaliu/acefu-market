<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  value: string
  unit?: string
  detail?: string
  tone?: 'neutral' | 'loss' | 'gain'
}>(), { unit: '', detail: '', tone: 'neutral' })
</script>

<template>
  <article class="stat" :data-tone="tone">
    <p class="stat-label">{{ label }}</p>
    <p class="stat-value">
      {{ value }}<span v-if="unit" class="stat-unit">{{ unit }}</span>
    </p>
    <p v-if="detail" class="stat-detail">{{ detail }}</p>
  </article>
</template>

<style scoped>
.stat {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.stat-label {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: 500;
}

.stat-value {
  margin: 0;
  color: var(--text-primary);
  font-size: 23px;
  font-weight: 650;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.stat[data-tone='loss'] .stat-value {
  color: var(--success);
}

.stat[data-tone='gain'] .stat-value {
  color: var(--warning);
}

.stat-unit {
  margin-left: 3px;
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: 500;
}

.stat-detail {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--text-xs);
  line-height: 1.45;
}
</style>
