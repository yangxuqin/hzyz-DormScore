<script setup lang="ts">
withDefaults(
  defineProps<{
    loading?: boolean;
    error?: string;
    empty?: boolean;
    emptyText?: string;
    loadingText?: string;
  }>(),
  { emptyText: '暂无数据', loadingText: '加载中…' },
);

defineEmits<{ (e: 'retry'): void }>();
</script>

<template>
  <div v-if="loading" class="state-box">
    <span class="spinner" aria-hidden="true"></span>
    <span>{{ loadingText }}</span>
  </div>
  <div v-else-if="error" class="state-box error">
    <span>{{ error }}</span>
    <button class="btn btn-outline btn-sm" @click="$emit('retry')">重试</button>
  </div>
  <div v-else-if="empty" class="state-box">
    <span>{{ emptyText }}</span>
  </div>
</template>

<style scoped>
.spinner {
  width: 22px;
  height: 22px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
