<!-- 日得分趋势折线图（满分 20 参考线） -->
<script setup lang="ts">
import { computed } from 'vue';
import type { EChartsOption } from 'echarts';
import type { DailyTrendPoint } from '@dorm/contracts';
import EChartBase from './EChartBase.vue';
import { readChartTheme, scoreColor } from './chartTheme';
import { formatDateCn } from '../../utils/date';

const props = defineProps<{ points: DailyTrendPoint[] }>();

const option = computed<EChartsOption>(() => {
  const t = readChartTheme();
  return {
    grid: { left: 40, right: 16, top: 24, bottom: 48 },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0]! : params;
        const point = props.points[p.dataIndex];
        if (!point) return '';
        return [
          `${formatDateCn(point.date)}（得分 <b>${point.score}</b> / 20）`,
          `扣分合计：${point.totalDeduction} 分`,
          `　床位 ${point.bedDeduction} · 公共 ${point.publicDeduction} · 纪律 ${point.disciplineDeduction}（讲话 ${point.talkCount} 次）`,
        ].join('<br/>');
      },
    },
    xAxis: {
      type: 'category',
      data: props.points.map((p) => p.date),
      axisLine: { lineStyle: { color: t.axis } },
      axisLabel: { rotate: props.points.length > 10 ? 45 : 0, color: t.text },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 20,
      name: '分',
      splitLine: { lineStyle: { color: t.split } },
      axisLabel: { color: t.text },
    },
    series: [
      {
        name: '日得分',
        type: 'line',
        data: props.points.map((p) => p.score),
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 2.5 },
        areaStyle: { opacity: 0.12 },
        itemStyle: {
          color: (param) => scoreColor(Number(param.value ?? 0)),
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { type: 'dashed', opacity: 0.45 },
          label: { formatter: '满分 20', color: t.text },
          data: [{ yAxis: 20 }],
        },
      },
    ],
  };
});
</script>

<template>
  <EChartBase :option="option" height="320px" />
</template>
