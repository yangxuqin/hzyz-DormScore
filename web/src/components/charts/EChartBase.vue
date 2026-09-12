<!-- ECharts 基础封装：resize 自适应、主题联动、卸载销毁 -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { useThemeStore } from '../../stores/theme';
import { themedDefaults } from './chartTheme';

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

function render(): void {
  if (!chart) return;
  const defaults = themedDefaults();
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
