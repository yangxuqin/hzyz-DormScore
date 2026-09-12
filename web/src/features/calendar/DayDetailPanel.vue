<!-- 单日明细面板：日期/星期/得分/值日生/请假 + 上下午扣分构成 -->
<script setup lang="ts">
import { computed } from 'vue';
import type { EnrichedRecord } from '@dorm/contracts';
import MStateBox from '../../components/ui/MStateBox.vue';
import { formatDateCn, weekdayOf } from '../../utils/date';
import PeriodPools from './PeriodPools.vue';

const props = defineProps<{
  date: string | null;
  score: number | null;
  record: EnrichedRecord | null;
  loading: boolean;
  error: string;
}>();

const emit = defineEmits<{ (e: 'retry'): void }>();

const leaveNames = computed(
  () => props.record?.userStatus.filter((s) => s.status === 'LEAVE').map((s) => s.userName) ?? [],
);
</script>

<template>
  <div class="day-detail">
    <template v-if="!date">
      <p class="text-muted type-body-medium">点击日历中的日期查看当日明细。</p>
    </template>

    <template v-else>
      <div class="detail-head">
        <div>
          <div class="type-title-large">{{ formatDateCn(date) }}</div>
          <div class="text-muted type-body-small">{{ weekdayOf(date) }}</div>
        </div>
        <div v-if="score !== null" class="detail-score">
          <span class="numeric value">{{ score }}</span>
          <span class="type-body-small text-muted">/ 20</span>
        </div>
        <span v-else class="m-badge">无记录</span>
      </div>

      <MStateBox
        v-if="score !== null"
        :loading="loading"
        :error="error"
        :empty="!record && !loading"
        empty-text="该日暂无有效记录"
        @retry="emit('retry')"
      >
        <template v-if="record">
          <div class="detail-meta type-body-medium">
            <span
              >值日生：<b>{{ record.dutyUserName }}</b></span
            >
            <span
              >请假：<b>{{ leaveNames.length ? leaveNames.join('、') : '无' }}</b></span
            >
          </div>

          <div class="detail-pools">
            <PeriodPools :record="record" period="AM" />
            <PeriodPools :record="record" period="PM" />
          </div>

          <div class="composition">
            <div class="comp-row">
              <span>床位扣分</span><b class="numeric">{{ record.bedDeduction }}</b>
            </div>
            <div class="comp-row">
              <span>公共区域</span><b class="numeric">{{ record.publicDeduction }}</b>
            </div>
            <div class="comp-row">
              <span>纪律（讲话 {{ record.talkCount }} 次）</span
              ><b class="numeric">{{ record.disciplineDeduction }}</b>
            </div>
            <hr class="divider" />
            <div class="comp-row comp-total">
              <span>总扣分</span><b class="numeric">{{ record.totalDeduction }}</b>
            </div>
            <div class="comp-row comp-total">
              <span>当日得分</span><b class="numeric">{{ record.score }} / 20</b>
            </div>
          </div>
        </template>
      </MStateBox>
      <p v-else class="text-muted type-body-small">非有效日，不参与周/月统计。</p>
    </template>
  </div>
</template>

<style scoped>
.day-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.detail-head {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  justify-content: space-between;
}
.detail-score .value {
  font-size: var(--text-display-small);
  font-weight: var(--weight-bold);
  color: var(--md-primary);
}
.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px var(--space-5);
  color: var(--md-on-surface-variant);
  margin-bottom: var(--space-4);
}
.detail-meta b {
  color: var(--md-on-surface);
}
.detail-pools {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--md-surface-container);
  border-radius: var(--shape-lg);
}
.composition {
  margin-top: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.comp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--text-body-medium);
  color: var(--md-on-surface-variant);
}
.comp-row b {
  color: var(--md-on-surface);
}
.comp-total {
  font-weight: var(--weight-semibold);
  color: var(--md-on-surface);
}
</style>
