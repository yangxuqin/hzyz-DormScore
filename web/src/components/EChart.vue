<!-- ECharts 封装：resize 自适应、主题联动（配色取自 CSS 变量）、卸载销毁 -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { useThemeStore } from '../stores/theme';

const props = withDefaults(
  defineProps<{
    option: EChartsOption;
    height?: string;
  }>(),
  { height: '320px' },
);

const el = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;
let observer: ResizeObserver | null = null;

const themeStore = useThemeStore();

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** 图表配色与文字颜色随主题变化 */
function chartTheme(): { color: string[]; text: string; axis: string } {
  return {
    color: Array.from({ length: 7 }, (_, i) => cssVar(`--chart-${i + 1}`, '#2563eb')),
    text: cssVar('--chart-text', '#334155'),
    axis: cssVar('--chart-axis', '#cbd5e1'),
  };
}

function render(): void {
  if (!chart) return;
  const theme = chartTheme();
  const defaults: EChartsOption = {
    color: theme.color,
    textStyle: { color: theme.text },
    tooltip: {
      backgroundColor: cssVar('--color-card', '#ffffff'),
      borderColor: cssVar('--color-border', '#e2e8f0'),
      textStyle: { color: cssVar('--color-text', '#0f172a') },
      extraCssText: 'box-shadow: var(--shadow-lg);',
    },
  };
  // 业务 option 的 tooltip 与主题默认 tooltip 合并（保底色/边框跟随主题）
  const merged: EChartsOption = {
    ...defaults,
    ...props.option,
    tooltip: {
      ...(defaults.tooltip as Record<string, unknown>),
      ...((props.option.tooltip ?? {}) as Record<string, unknown>),
    },
  };
  chart.setOption(merged, { notMerge: true });
}

function handleWindowResize(): void {
  chart?.resize();
}

onMounted(() => {
  if (!el.value) return;
  chart = echarts.init(el.value);
  render();
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => chart?.resize());
    observer.observe(el.value);
  }
  window.addEventListener('resize', handleWindowResize);
});

watch(
  () => props.option,
  () => render(),
  { deep: true },
);

// 主题切换时用新配色重绘
watch(
  () => themeStore.theme,
  () => render(),
);

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize);
  observer?.disconnect();
  observer = null;
  chart?.dispose();
  chart = null;
});
</script>

<template>
  <div ref="el" class="echart" :style="{ height }" />
</template>

<style scoped>
.echart {
  width: 100%;
  min-height: 220px;
}
</style>
