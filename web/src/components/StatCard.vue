<script setup lang="ts">
defineProps<{ label: string; value: string; unit?: string; hint?: string }>();
</script>

<template>
  <div class="stat-card">
    <div class="stat-label">{{ label }}</div>
    <div class="stat-value">
      {{ value }}<span v-if="unit" class="stat-unit">{{ unit }}</span>
    </div>
    <div v-if="hint" class="stat-hint">{{ hint }}</div>
  </div>
</template>

<style scoped>
.stat-card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 14px 16px;
}

.stat-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--color-text);
  margin-top: 4px;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

/* 大屏 / 电视展示：KPI 数字放大，远处可读 */
@media (min-width: 1280px) {
  .stat-label {
    font-size: 14px;
  }

  .stat-value {
    font-size: 34px;
  }
}

.stat-unit {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-left: 4px;
}

.stat-hint {
  font-size: 12px;
  color: var(--color-muted);
  margin-top: 4px;
}
</style>
