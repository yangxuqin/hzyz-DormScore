<!-- 纪律记录：只列出实际违纪的日期与次数 -->
<script setup lang="ts">
import type { DisciplineRecord } from '@dorm/contracts';
import MCard from '../../components/ui/MCard.vue';
import MStateBox from '../../components/ui/MStateBox.vue';
import { formatDateCn, weekdayOf } from '../../utils/date';

defineProps<{
  records: DisciplineRecord[];
  loading: boolean;
  error: string;
}>();

const emit = defineEmits<{ (e: 'retry'): void }>();
</script>

<template>
  <MCard variant="elevated">
    <div class="card-title"><span>纪律记录</span></div>
    <MStateBox
      :loading="loading"
      :error="error"
      :empty="!loading && !error && records.length === 0"
      empty-text="暂无违纪记录"
      @retry="emit('retry')"
    >
      <div class="disc-list">
        <div v-for="r in records" :key="r.date" class="disc-row">
          <div class="disc-date">
            <b>{{ formatDateCn(r.date) }}</b>
            <span class="text-muted type-body-small">{{ weekdayOf(r.date) }}</span>
          </div>
          <div class="disc-counts type-body-medium">
            <span>上午 {{ r.talkAm }} 次</span>
            <span>下午 {{ r.talkPm }} 次</span>
          </div>
          <span class="m-badge m-badge--danger">{{ r.count }} 次 · 扣 {{ r.count * 2 }} 分</span>
        </div>
      </div>
    </MStateBox>
  </MCard>
</template>

<style scoped>
.disc-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.disc-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
  padding: var(--space-3) var(--space-4);
  background: var(--md-surface-container);
  border-radius: var(--shape-lg);
}
.disc-date {
  display: flex;
  flex-direction: column;
  min-width: 72px;
}
.disc-counts {
  display: flex;
  gap: var(--space-4);
  color: var(--md-on-surface-variant);
  flex: 1;
}
</style>
