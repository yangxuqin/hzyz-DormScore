<!-- 成绩概览：今日得分 hero + 周/月得分率 + 今日扣分构成 -->
<script setup lang="ts">
import { computed } from 'vue';
import type { OverviewData } from '@dorm/contracts';
import MCard from '../../components/ui/MCard.vue';
import MStateBox from '../../components/ui/MStateBox.vue';
import MScoreRing from '../../components/ui/MScoreRing.vue';
import { formatRate, scoreTier, SCORE_TIER_LABEL } from '../../domain/pools';
import { formatDateCn } from '../../utils/date';
import PeriodPools from '../calendar/PeriodPools.vue';

const props = defineProps<{
  data: OverviewData | null;
  loading: boolean;
  error: string;
}>();

const emit = defineEmits<{ (e: 'retry'): void }>();

const today = computed(() => props.data?.today ?? null);
const tier = computed(() => scoreTier(today.value?.score ?? null));

const tiles = computed(() => [
  {
    label: '今日扣分',
    value: today.value ? String(today.value.totalDeduction) : '-',
    unit: '分',
    hint: today.value
      ? `床位 ${today.value.bedDeduction} · 公共 ${today.value.publicDeduction} · 纪律 ${today.value.disciplineDeduction}`
      : '今日暂无记录',
  },
  {
    label: '本周得分率',
    value: props.data?.weekRate ? `${formatRate(props.data.weekRate.rate)}%` : '-',
    unit: '',
    hint: props.data?.weekRate
      ? `${props.data.weekRate.label} · ${props.data.weekRate.days} 个有效日`
      : '本周暂无有效记录',
  },
  {
    label: '本月得分率',
    value: props.data?.monthRate ? `${formatRate(props.data.monthRate.rate)}%` : '-',
    unit: '',
    hint: props.data?.monthRate
      ? `${props.data.monthRate.label} · ${props.data.monthRate.days} 个有效日`
      : '本月暂无有效记录',
  },
]);

const leaveNames = computed(
  () => today.value?.userStatus.filter((s) => s.status === 'LEAVE').map((s) => s.userName) ?? [],
);
</script>

<template>
  <MStateBox :loading="loading" :error="error" @retry="emit('retry')">
    <MCard variant="hero" class="overview enter-fade">
      <div class="overview-hero">
        <div class="hero-left">
          <div class="section-label">今日得分</div>
          <MScoreRing :score="today?.score ?? null" :max="20" :size="148" />
          <div class="hero-tier m-badge" :class="`tier-${tier}`">
            {{ today ? SCORE_TIER_LABEL[tier] : '今日暂无记录' }}
          </div>
        </div>

        <div class="hero-right">
          <div class="hero-title-row">
            <h2 class="type-headline-medium">宿舍成绩</h2>
            <span class="text-muted type-body-medium">
              {{ today ? `${formatDateCn(today.date)} ${today.weekday}` : '今天还没有检查记录' }}
            </span>
          </div>

          <div class="hero-meta">
            <span
              >值日生：<b>{{ today?.dutyUserName ?? '-' }}</b></span
            >
            <span>
              请假：
              <b>{{ leaveNames.length ? leaveNames.join('、') : '无' }}</b>
            </span>
            <span v-if="today"
              >扣分合计：<b>{{ today.totalDeduction }}</b> 分</span
            >
          </div>

          <div v-if="today" class="hero-pools">
            <PeriodPools :record="today" period="AM" />
            <PeriodPools :record="today" period="PM" />
          </div>
        </div>
      </div>

      <div class="overview-tiles">
        <div v-for="tile in tiles" :key="tile.label" class="tile">
          <div class="tile-label type-label-medium">{{ tile.label }}</div>
          <div class="tile-value numeric">
            {{ tile.value }}<span v-if="tile.unit" class="tile-unit">{{ tile.unit }}</span>
          </div>
          <div class="tile-hint type-body-small text-muted">{{ tile.hint }}</div>
        </div>
      </div>
    </MCard>
  </MStateBox>
</template>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.overview-hero {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-5);
  align-items: center;
}
.hero-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}
.hero-tier.tier-excellent,
.hero-tier.tier-good {
  background: var(--md-primary-container);
  color: var(--md-on-primary-container);
}
.hero-tier.tier-fair {
  background: var(--md-tertiary-container);
  color: var(--md-on-tertiary-container);
}
.hero-tier.tier-poor,
.hero-tier.tier-critical {
  background: var(--md-error-container);
  color: var(--md-on-error-container);
}
.hero-title-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px var(--space-5);
  font-size: var(--text-body-medium);
  color: var(--md-on-surface-variant);
  margin: var(--space-3) 0 var(--space-4);
}
.hero-meta b {
  color: var(--md-on-surface);
}
.hero-pools {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}

.overview-tiles {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
}
.tile {
  background: var(--md-surface-container);
  border-radius: var(--shape-xl);
  padding: var(--space-4);
}
.tile-label {
  color: var(--md-on-surface-variant);
}
.tile-value {
  font-size: var(--text-headline-large);
  font-weight: var(--weight-bold);
  line-height: 1.15;
  margin-top: 2px;
}
.tile-unit {
  font-size: var(--text-title-small);
  font-weight: var(--weight-medium);
  color: var(--md-on-surface-variant);
  margin-left: 4px;
}
.tile-hint {
  margin-top: 2px;
}

@media (min-width: 768px) {
  .overview-hero {
    grid-template-columns: 200px 1fr;
    align-items: start;
  }
  .hero-pools {
    grid-template-columns: 1fr 1fr;
  }
  .overview-tiles {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
