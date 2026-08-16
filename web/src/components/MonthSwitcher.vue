<script setup lang="ts">
const props = defineProps<{ months: string[]; modelValue: string | null }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

function onChange(e: Event): void {
  const value = (e.target as HTMLSelectElement).value;
  if (value) emit('update:modelValue', value);
}

/** 2026-08 → 2026年8月 */
function monthLabel(m: string): string {
  const [y, mm] = m.split('-');
  if (!y || !mm) return m;
  return `${y}年${Number(mm)}月`;
}
</script>

<template>
  <select class="select month-switcher" :value="modelValue ?? ''" @change="onChange">
    <option v-for="m in months" :key="m" :value="m">{{ monthLabel(m) }}</option>
  </select>
</template>

<style scoped>
.month-switcher {
  width: auto;
  min-width: 130px;
  min-height: 36px;
  font-size: 14px;
}
</style>
