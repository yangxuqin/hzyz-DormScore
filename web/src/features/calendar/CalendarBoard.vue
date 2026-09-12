<!-- 日历看板：桌面 日历 | 当日明细 双栏；手机上下排列 -->
<script setup lang="ts">
import type { CalendarStats, EnrichedRecord } from '@dorm/contracts';
import MCard from '../../components/ui/MCard.vue';
import MStateBox from '../../components/ui/MStateBox.vue';
import MButton from '../../components/ui/MButton.vue';
import MIcon from '../../components/ui/MIcon.vue';
import CalendarSection from './CalendarSection.vue';
import DayDetailPanel from './DayDetailPanel.vue';
import { formatMonthCn } from '../../utils/date';

const props = defineProps<{
  data: CalendarStats | null;
  loading: boolean;
  error: string;
  selectedDay: string | null;
  selectedScore: number | null;
  record: EnrichedRecord | null;
  dayLoading: boolean;
  dayError: string;
}>();

const emit = defineEmits<{
  (e: 'month-change', month: string): void;
  (e: 'select-day', date: string): void;
  (e: 'retry-calendar'): void;
  (e: 'retry-day'): void;
}>();

function onMonthSelect(e: Event): void {
  const value = (e.target as HTMLSelectElement).value;
  if (value) emit('month-change', value);
}
</script>

<template>
  <div class="calendar-board">
    <MCard variant="elevated" class="board-calendar">
      <div class="card-title">
        <span>本月日历</span>
        <select
          v-if="data"
          class="m-select month-select"
          :value="data.selectedMonth"
          aria-label="选择月份"
          @change="onMonthSelect"
        >
          <option v-for="m in data.months" :key="m" :value="m">{{ formatMonthCn(m) }}</option>
        </select>
      </div>
      <MStateBox :loading="loading" :error="error" @retry="emit('retry-calendar')">
        <CalendarSection
          v-if="data"
          :data="data"
          :selected-day="selectedDay"
          :today="new Date().toISOString().slice(0, 10)"
          @select-day="(d) => emit('select-day', d)"
        />
      </MStateBox>
    </MCard>

    <MCard variant="elevated" class="board-detail">
      <div class="card-title">
        <span>当日明细</span>
        <slot name="detail-actions" />
      </div>
      <DayDetailPanel
        :date="selectedDay"
        :score="selectedScore"
        :record="record"
        :loading="dayLoading"
        :error="dayError"
        @retry="emit('retry-day')"
      />
    </MCard>
  </div>
</template>

<style scoped>
.calendar-board {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-5);
  align-items: start;
}
.month-select {
  width: auto;
  min-width: 132px;
  min-height: 40px;
}

/* 平板 768-1023：上下排列（日历在上、明细在下），日历不全宽更自然 */
@media (min-width: 768px) {
  .board-calendar,
  .board-detail {
    max-width: 100%;
  }
}

/* 桌面 >=1024：日历 1.35fr + 明细 0.65fr 双栏，消除右侧空白 */
@media (min-width: 1024px) {
  .calendar-board {
    grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.65fr);
  }
}
</style>
