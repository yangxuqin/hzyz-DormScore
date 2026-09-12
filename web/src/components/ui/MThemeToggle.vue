<!-- 明亮 / 暗夜模式切换 -->
<script setup lang="ts">
import { useThemeStore } from '../../stores/theme';
import MIcon from './MIcon.vue';

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
    <MIcon :name="themeStore.theme === 'light' ? 'moon' : 'sun'" :size="18" />
  </button>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--shape-full);
  border: 1px solid var(--md-outline-variant);
  background: var(--md-surface-container-low);
  color: var(--md-on-surface-variant);
  transition:
    background var(--motion-fast) var(--ease-standard),
    color var(--motion-fast) var(--ease-standard);
}
.theme-toggle:hover {
  background: var(--md-surface-container-high);
  color: var(--md-on-surface);
}
</style>
