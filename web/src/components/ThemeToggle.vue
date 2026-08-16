<!-- 明亮/暗夜模式切换按钮 -->
<script setup lang="ts">
import { useThemeStore } from '../stores/theme';

const themeStore = useThemeStore();
</script>

<template>
  <button
    class="theme-toggle"
    type="button"
    :aria-label="themeStore.theme === 'light' ? '切换到暗夜模式' : '切换到明亮模式'"
    :title="themeStore.theme === 'light' ? '切换到暗夜模式' : '切换到明亮模式'"
    @click="themeStore.toggle()"
  >
    <span aria-hidden="true">{{ themeStore.theme === 'light' ? '🌙' : '☀️' }}</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-card);
  font-size: 17px;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.theme-toggle:not(:disabled):hover {
  background: var(--color-bg);
}
</style>
