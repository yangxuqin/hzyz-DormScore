<!-- 卫生扣分频次柱状图 -->
<script setup lang="ts">
import { computed } from 'vue';
import type { EChartsOption } from 'echarts';
import EChartBase from './EChartBase.vue';
import { readChartTheme } from './chartTheme';

const props = defineProps<{ items: { label: string; count: number }[] }>();

const total = computed(() => props.items.reduce((sum, i) => sum + i.count, 0));

const option = computed<EChartsOption>(() => {
  const t = readChartTheme();
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0]! : params;
        const count = Number(p.value ?? 0);
        const pct = total.value > 0 ? ((count / total.value) * 100).toFixed(1) : '0.0';
        return `${p.name}<br/>发生次数：<b>${count} 次</b>（占 ${pct}%）`;
      },
    },
    grid: { left: 40, right: 16, top: 28, bottom: 52 },
    xAxis: {
      type: 'category',
      data: props.items.map((i) => i.label),
      axisLabel: { interval: 0, rotate: 30, color: t.text },
      axisLine: { lineStyle: { color: t.axis } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      name: '次',
      splitLine: { lineStyle: { color: t.split } },
      axisLabel: { color: t.text },
    },
    series: [
      {
        name: '发生次数',
        type: 'bar',
        data: props.items.map((i) => i.count),
        barMaxWidth: 34,
        itemStyle: { borderRadius: [6, 6, 0, 0] },
        label: { show: true, position: 'top', formatter: '{c}', fontSize: 11, color: t.text },
      },
    ],
  };
});
</script>

<template>
  <EChartBase :option="option" height="320px" />
</template>
