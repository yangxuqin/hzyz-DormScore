<!-- 卫生扣分频次：各检查项目发生次数 -->
<script setup lang="ts">
import { computed } from 'vue';
import type { FrequencyStats } from '@dorm/contracts';
import MCard from '../../components/ui/MCard.vue';
import MStateBox from '../../components/ui/MStateBox.vue';
import FrequencyChart from '../../components/charts/FrequencyChart.vue';
import { formatMonthCn } from '../../utils/date';

const props = defineProps<{
  data: FrequencyStats | null;
  loading: boolean;
  error: string;
}>();

const emit = defineEmits<{
  (e: 'month-change', month: string): void;
  (e: 'retry'): void;
}>();

const total = computed(() => (props.data?.items ?? []).reduce((sum, i) => sum + i.count, 0));

function onMonthSelect(e: Event): void {
  const value = (e.target as HTMLSelectElement).value;
  if (value) emit('month-change', value);
}
</script>

<template>
  <MCard variant="elevated">
    <div class="card-title">
      <span
        >卫生扣分频次<span class="text-muted type-body-small">（共 {{ total }} 次）</span></span
      >
      <select
        v-if="data?.months.length"
        class="m-select month-select"
        :value="data.selectedMonth ?? ''"
        aria-label="选择月份"
        @change="onMonthSelect"
      >
        <option v-for="m in data.months" :key="m" :value="m">{{ formatMonthCn(m) }}</option>
      </select>
    </div>
    <MStateBox
      :loading="loading"
      :error="error"
      :empty="!loading && !error && (!data || data.selectedMonth === null)"
      empty-text="暂无频次数据"
      @retry="emit('retry')"
    >
      <FrequencyChart v-if="data" :items="data.items" />
    </MStateBox>
  </MCard>
</template>

<style scoped>
.month-select {
  width: auto;
  min-width: 132px;
  min-height: 40px;
}
</style>
