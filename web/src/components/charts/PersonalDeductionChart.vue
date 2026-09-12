<!-- 个人月累计扣分：床位 / 公共堆叠柱状图 -->
<script setup lang="ts">
import { computed } from 'vue';
import type { EChartsOption } from 'echarts';
import type { PersonalUser } from '@dorm/contracts';
import EChartBase from './EChartBase.vue';
import { readChartTheme } from './chartTheme';

const props = defineProps<{ users: PersonalUser[] }>();

const option = computed<EChartsOption>(() => {
  const t = readChartTheme();
  const users = props.users;
  return {
    legend: { top: 0, textStyle: { color: t.text } },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        const user = users.find((u) => u.name === list[0]?.name);
        if (!user) return '';
        return [
          `<b>${user.name}</b>（本月合计 ${user.deduction} 分）`,
          `床位扣分池分摊：${user.bedDeduction} 分`,
          `值日公共区域：${user.publicDeduction} 分`,
          `本月值日：${user.dutyCount} 天`,
        ].join('<br/>');
      },
    },
    grid: { left: 40, right: 16, top: 36, bottom: 28 },
    xAxis: {
      type: 'category',
      data: users.map((u) => u.name),
      axisLabel: { interval: 0, color: t.text },
      axisLine: { lineStyle: { color: t.axis } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      name: '分',
      splitLine: { lineStyle: { color: t.split } },
      axisLabel: { color: t.text },
    },
    series: [
      {
        name: '床位扣分',
        type: 'bar',
        stack: 'total',
        data: users.map((u) => u.bedDeduction),
        barMaxWidth: 34,
      },
      {
        name: '公共区域',
        type: 'bar',
        stack: 'total',
        data: users.map((u) => u.publicDeduction),
        barMaxWidth: 34,
        itemStyle: { borderRadius: [6, 6, 0, 0] },
        label: {
          show: true,
          position: 'top',
          formatter: (p) => String(users[p.dataIndex]?.deduction ?? 0),
          fontSize: 11,
          color: t.text,
        },
      },
    ],
  };
});
</script>

<template>
  <EChartBase :option="option" height="300px" />
</template>
