<!-- 月得分率趋势 -->
<script setup lang="ts">
import type { MonthlyTrendPoint } from '@dorm/contracts';
import RateBarChart from './RateBarChart.vue';

defineProps<{ points: MonthlyTrendPoint[] }>();
</script>

<template>
  <RateBarChart :points="points" name="月得分率" />
</template>
