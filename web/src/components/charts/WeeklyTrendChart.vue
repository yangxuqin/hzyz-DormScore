<!-- 周得分率趋势 -->
<script setup lang="ts">
import type { WeeklyTrendPoint } from '@dorm/contracts';
import RateBarChart from './RateBarChart.vue';

defineProps<{ points: WeeklyTrendPoint[] }>();
</script>

<template>
  <RateBarChart :points="points" name="周得分率" />
</template>
