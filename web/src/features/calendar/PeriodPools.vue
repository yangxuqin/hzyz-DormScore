<!-- 单时段扣分池渲染：床面 / 床下 / 公共区域 / 讲话（展示页与录入页共用） -->
<script setup lang="ts">
import { computed } from 'vue';
import type { BedPoolView, EnrichedRecord, Period } from '@dorm/contracts';
import { BED_ITEM_LABELS, PUBLIC_ITEM_LABELS, periodLabel } from '../../domain/constants';
import { formatShare } from '../../domain/pools';

const props = defineProps<{ record: EnrichedRecord; period: Period }>();

const pools = computed(() => props.record.bedChecks.filter((p) => p.period === props.period));
const publics = computed(() => props.record.publicChecks.filter((p) => p.period === props.period));
const talk = computed(() => (props.period === 'AM' ? props.record.talkAm : props.record.talkPm));

function poolOf(item: BedPoolView['item']): BedPoolView | undefined {
  return pools.value.find((p) => p.item === item);
}

function shareText(pool: BedPoolView): string {
  if (pool.responsibleUsers.length === 0) return '命中床位人员均请假，个人不承担';
  return pool.responsibleUsers.map((u) => `${u.name} ${formatShare(u.share)}`).join('、');
}

const hasAny = computed(
  () => pools.value.length + publics.value.length + (talk.value > 0 ? 1 : 0) > 0,
);
</script>

<template>
  <div class="period-block">
    <div class="period-head">
      <span class="type-label-large">{{ periodLabel(period) }}</span>
      <span v-if="!hasAny" class="m-badge">无扣分项</span>
    </div>

    <template v-if="hasAny">
      <div v-for="item in ['BED', 'FLOOR'] as const" :key="item" class="pool-row">
        <template v-if="poolOf(item)">
          <div class="pool-line">
            <span class="pool-name">{{ BED_ITEM_LABELS[item] }}</span>
            <span class="pool-beds">
              <span
                v-for="(name, i) in poolOf(item)!.bedNames"
                :key="name"
                class="m-chip m-chip--static"
                >{{ name }}<template v-if="i < poolOf(item)!.bedNames.length - 1"></template
              ></span>
            </span>
            <span class="pool-ded numeric">-{{ poolOf(item)!.deduction }}</span>
          </div>
          <div class="pool-share type-body-small">责任人：{{ shareText(poolOf(item)!) }}</div>
        </template>
      </div>

      <div v-if="publics.length" class="pool-line pool-line--wrap">
        <span class="pool-name">公共区域</span>
        <span class="pool-beds">
          <span v-for="p in publics" :key="p.item" class="m-chip m-chip--static">{{
            PUBLIC_ITEM_LABELS[p.item]
          }}</span>
        </span>
        <span class="pool-ded numeric">-{{ publics.length }}</span>
      </div>

      <div v-if="talk > 0" class="pool-line">
        <span class="pool-name">讲话</span>
        <span class="pool-beds"
          ><span class="m-chip m-chip--static">{{ talk }} 次</span></span
        >
        <span class="pool-ded numeric">-{{ talk * 2 }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.period-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.period-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.pool-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pool-line {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: nowrap;
}
.pool-line--wrap {
  flex-wrap: wrap;
}
.pool-name {
  font-size: var(--text-label-large);
  color: var(--md-on-surface-variant);
  min-width: 62px;
  flex-shrink: 0;
}
.pool-beds {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.pool-ded {
  margin-left: auto;
  font-weight: var(--weight-semibold);
  color: var(--md-error);
  flex-shrink: 0;
}
.pool-share {
  color: var(--md-on-surface-variant);
}
</style>
