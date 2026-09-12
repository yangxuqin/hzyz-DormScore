<!-- 周期得分率柱状图（周 / 月共用） -->
<script setup lang="ts">
import { computed } from 'vue';
import type { EChartsOption } from 'echarts';
import EChartBase from './EChartBase.vue';
import { readChartTheme } from './chartTheme';

const props = defineProps<{
  points: { label: string; rate: number; days: number }[];
  name: string;
}>();

const option = computed<EChartsOption>(() => {
  const t = readChartTheme();
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0]! : params;
        const point = props.points[p.dataIndex];
        return point
          ? `${point.label}<br/>得分率：<b>${point.rate}%</b><br/>有效天数：${point.days} 天`
          : '';
      },
    },
    grid: { left: 44, right: 16, top: 30, bottom: 52 },
    xAxis: {
      type: 'category',
      data: props.points.map((p) => p.label),
      axisLabel: { rotate: 45, color: t.text },
      axisLine: { lineStyle: { color: t.axis } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { formatter: '{value}%', color: t.text },
      splitLine: { lineStyle: { color: t.split } },
    },
    series: [
      {
        name: props.name,
        type: 'bar',
        data: props.points.map((p) => p.rate),
        barMaxWidth: 46,
        itemStyle: { borderRadius: [6, 6, 0, 0] },
        label: { show: true, position: 'top', formatter: '{c}%', fontSize: 11, color: t.text },
      },
    ],
  };
});
</script>

<template>
  <EChartBase :option="option" height="320px" />
</template>
