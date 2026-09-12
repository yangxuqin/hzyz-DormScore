<!-- 月历网格：按 0-20 分做 tonal 表现层，点击日期查看明细 -->
<script setup lang="ts">
import { computed } from 'vue';
import type { CalendarStats } from '@dorm/contracts';
import { scoreTier, SCORE_TIER_LABEL } from '../../domain/pools';
import { formatDateCn } from '../../utils/date';

const props = defineProps<{
  data: CalendarStats;
  selectedDay: string | null;
  today: string;
}>();

const emit = defineEmits<{ (e: 'select-day', date: string): void }>();

const leading = computed(() => {
  const first = props.data.days[0];
  return first ? Math.max(0, first.weekday - 1) : 0;
});

const WEEK_HEADS = ['一', '二', '三', '四', '五', '六', '日'];

function tier(score: number | null) {
  return scoreTier(score);
}

function title(day: { date: string; score: number | null }): string {
  if (day.score === null) return `${formatDateCn(day.date)} 无记录`;
  return `${formatDateCn(day.date)} 得分 ${day.score}（${SCORE_TIER_LABEL[scoreTier(day.score)]}）`;
}

const marginDays = computed(() => {
  const filled = leading.value + props.data.days.length;
  return (7 - (filled % 7)) % 7;
});
</script>

<template>
  <div class="calendar">
    <div class="calendar-grid">
      <div v-for="w in WEEK_HEADS" :key="w" class="cal-head type-label-small">{{ w }}</div>
      <div v-for="i in leading" :key="`lead-${i}`" class="cal-spacer" />
      <button
        v-for="day in data.days"
        :key="day.date"
        type="button"
        class="cal-cell"
        :class="[
          `tier-${tier(day.score)}`,
          { today: day.date === today, selected: selectedDay === day.date },
        ]"
        :title="title(day)"
        :aria-label="title(day)"
        @click="emit('select-day', day.date)"
      >
        <span class="cal-day numeric">{{ Number(day.date.slice(-2)) }}</span>
        <span v-if="day.score !== null" class="cal-score numeric">{{ day.score }}</span>
      </button>
      <div v-for="i in marginDays" :key="`tail-${i}`" class="cal-spacer" />
    </div>

    <div class="calendar-legend type-label-small">
      <span><i class="dot tier-excellent" />20 优秀</span>
      <span><i class="dot tier-good" />15-19 良好</span>
      <span><i class="dot tier-fair" />10-14 一般</span>
      <span><i class="dot tier-poor" />5-9 较差</span>
      <span><i class="dot tier-critical" />0-4 严重</span>
      <span><i class="dot tier-none" />无记录</span>
    </div>
  </div>
</template>

<style scoped>
.calendar {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}
.cal-head {
  text-align: center;
  color: var(--md-on-surface-variant);
  padding: 2px 0;
}
.cal-spacer {
  aspect-ratio: 1;
}
.cal-cell {
  position: relative;
  aspect-ratio: 1;
  min-height: 42px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  border: 2px solid transparent;
  border-radius: var(--shape-md);
  background: var(--md-surface-container-high);
  color: var(--md-on-surface);
  transition:
    transform var(--motion-fast) var(--ease-standard),
    box-shadow var(--motion-fast) var(--ease-standard),
    border-color var(--motion-fast) var(--ease-standard);
}
.cal-cell:hover {
  transform: translateY(-1px) scale(1.04);
  box-shadow: var(--elev-1);
}
.cal-day {
  font-size: 13px;
  font-weight: var(--weight-semibold);
  line-height: 1;
}
.cal-score {
  font-size: 11px;
  font-weight: var(--weight-medium);
  line-height: 1;
  opacity: 0.9;
}
.cal-cell.tier-none {
  color: var(--md-on-surface-variant);
  background: var(--md-surface-container-high);
}
.cal-cell.tier-excellent,
.cal-cell.tier-good {
  background: var(--score-good);
  color: var(--score-on-dark);
}
.cal-cell.tier-excellent {
  background: var(--score-excellent);
}
.cal-cell.tier-fair {
  background: var(--score-fair);
  color: var(--score-on-dark);
}
.cal-cell.tier-poor {
  background: var(--score-poor);
  color: var(--score-on-dark);
}
.cal-cell.tier-critical {
  background: var(--score-critical);
  color: #fff;
}
.cal-cell.today {
  border-color: var(--md-primary);
}
.cal-cell.selected {
  border-color: var(--md-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--md-primary) 30%, transparent);
}
.calendar-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px var(--space-4);
  color: var(--md-on-surface-variant);
}
.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 5px;
  vertical-align: -1px;
}
.dot.tier-excellent {
  background: var(--score-excellent);
}
.dot.tier-good {
  background: var(--score-good);
}
.dot.tier-fair {
  background: var(--score-fair);
}
.dot.tier-poor {
  background: var(--score-poor);
}
.dot.tier-critical {
  background: var(--score-critical);
}
.dot.tier-none {
  background: var(--score-none);
  border: 1px solid var(--md-outline-variant);
}

/* 手机端单元格只显示日期，分值在明细面板查看 */
@media (max-width: 767px) {
  .cal-score {
    display: none;
  }
}
@media (min-width: 1024px) {
  .cal-cell {
    min-height: 56px;
  }
  .cal-day {
    font-size: 15px;
  }
  .cal-score {
    font-size: 12px;
  }
}
</style>
