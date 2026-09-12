<!-- 个人分析：月累计个人扣分（床位/公共构成）+ 值日天数 -->
<script setup lang="ts">
import type { PersonalStats } from '@dorm/contracts';
import MCard from '../../components/ui/MCard.vue';
import MStateBox from '../../components/ui/MStateBox.vue';
import PersonalDeductionChart from '../../components/charts/PersonalDeductionChart.vue';
import { formatMonthCn } from '../../utils/date';

const props = defineProps<{
  data: PersonalStats | null;
  loading: boolean;
  error: string;
}>();

const emit = defineEmits<{
  (e: 'month-change', month: string): void;
  (e: 'retry'): void;
}>();

function onMonthSelect(e: Event): void {
  const value = (e.target as HTMLSelectElement).value;
  if (value) emit('month-change', value);
}
</script>

<template>
  <MCard variant="elevated">
    <div class="card-title">
      <span>个人分析（月累计扣分）</span>
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
      empty-text="暂无个人扣分数据"
      @retry="emit('retry')"
    >
      <template v-if="data && data.selectedMonth">
        <PersonalDeductionChart :users="data.users" />
        <div class="duty-block">
          <div class="section-label">本月值日</div>
          <div class="duty-chips">
            <span
              v-for="u in data.users"
              :key="u.userId"
              class="m-badge"
              :class="u.dutyCount > 0 ? 'm-badge--primary' : ''"
              >{{ u.name }} · {{ u.dutyCount }} 天</span
            >
          </div>
        </div>
      </template>
    </MStateBox>
  </MCard>
</template>

<style scoped>
.month-select {
  width: auto;
  min-width: 132px;
  min-height: 40px;
}
.duty-block {
  margin-top: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.duty-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
