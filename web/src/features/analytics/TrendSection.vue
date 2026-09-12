<!-- 成绩趋势：日得分 / 周得分率 / 月得分率 切换 -->
<script setup lang="ts">
import { computed, ref } from 'vue';
import type { DailyTrendPoint, MonthlyTrendPoint, WeeklyTrendPoint } from '@dorm/contracts';
import MCard from '../../components/ui/MCard.vue';
import MStateBox from '../../components/ui/MStateBox.vue';
import MSegmented from '../../components/ui/MSegmented.vue';
import DailyTrendChart from '../../components/charts/DailyTrendChart.vue';
import WeeklyTrendChart from '../../components/charts/WeeklyTrendChart.vue';
import MonthlyTrendChart from '../../components/charts/MonthlyTrendChart.vue';

type TrendTab = 'daily' | 'weekly' | 'monthly';

const props = defineProps<{
  daily: DailyTrendPoint[];
  weekly: WeeklyTrendPoint[];
  monthly: MonthlyTrendPoint[];
  loading: boolean;
  error: string;
}>();

const emit = defineEmits<{ (e: 'retry'): void }>();

const tab = ref<TrendTab>('daily');

const TABS = [
  { value: 'daily', label: '日得分' },
  { value: 'weekly', label: '周得分率' },
  { value: 'monthly', label: '月得分率' },
];

const empty = computed(() => {
  if (tab.value === 'daily') return props.daily.length === 0;
  if (tab.value === 'weekly') return props.weekly.length === 0;
  return props.monthly.length === 0;
});

const emptyText = computed(() => `暂无${TABS.find((t) => t.value === tab.value)?.label ?? ''}数据`);
</script>

<template>
  <MCard variant="elevated">
    <div class="card-title">
      <span>成绩趋势</span>
      <MSegmented v-model="tab" :options="TABS" />
    </div>
    <MStateBox
      :loading="loading"
      :error="error"
      :empty="empty"
      :empty-text="emptyText"
      @retry="emit('retry')"
    >
      <DailyTrendChart v-if="tab === 'daily'" :points="daily" />
      <WeeklyTrendChart v-else-if="tab === 'weekly'" :points="weekly" />
      <MonthlyTrendChart v-else :points="monthly" />
    </MStateBox>
  </MCard>
</template>

<style scoped>
@media (max-width: 480px) {
  .card-title {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
