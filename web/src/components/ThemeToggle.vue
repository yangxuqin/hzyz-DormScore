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
    <span aria-hidden="true" class="theme-icon">
      <!-- 月亮：切换到暗夜模式 -->
      <svg
        v-if="themeStore.theme === 'light'"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
      <!-- 太阳：切换到明亮模式 -->
      <svg
        v-else
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>
    </span>
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
  color: var(--color-text-secondary);
  font-size: 17px;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.theme-toggle:not(:disabled):hover {
  background: var(--color-bg);
}

.theme-icon {
  display: inline-flex;
}
</style>
