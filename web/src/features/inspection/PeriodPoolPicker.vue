<!-- 扣分池选择器：一个时段的一个区域（床面/床下）选择命中床位 -->
<script setup lang="ts">
import { computed } from 'vue';
import type { AppConfig, BedItem, Period, UserStatus } from '@dorm/contracts';
import { BED_ITEM_LABELS, BED_POOL_POINTS } from '../../domain/constants';
import { formatShare } from '../../domain/pools';

const props = defineProps<{
  config: AppConfig;
  period: Period;
  item: BedItem;
  /** 已选床位 id */
  selected: number[];
  userStatus: Map<number, UserStatus>;
}>();

const emit = defineEmits<{ (e: 'toggle', bedId: number): void }>();

const label = computed(() => BED_ITEM_LABELS[props.item]);

const responsible = computed(() => {
  const beds = new Set(props.selected);
  return props.config.users.filter(
    (u) => beds.has(u.bedId) && props.userStatus.get(u.id) === 'NORMAL',
  );
});

const perUser = computed(() =>
  responsible.value.length === 0 ? 0 : BED_POOL_POINTS / responsible.value.length,
);

const hasSelection = computed(() => props.selected.length > 0);
</script>

<template>
  <div class="pool-picker" :class="{ active: hasSelection }">
    <div class="pool-head">
      <span class="type-label-large">{{ label }}</span>
      <span class="pool-points" :class="{ on: hasSelection }">
        当前 {{ hasSelection ? BED_POOL_POINTS : 0 }} / {{ BED_POOL_POINTS }} 分
      </span>
    </div>

    <div class="bed-options">
      <button
        v-for="bed in config.beds"
        :key="bed.id"
        type="button"
        class="m-chip bed-chip"
        :class="{ 'm-chip--selected': selected.includes(bed.id) }"
        :aria-pressed="selected.includes(bed.id)"
        @click="emit('toggle', bed.id)"
      >
        {{ bed.name }}
      </button>
    </div>

    <div v-if="hasSelection" class="pool-responsible type-body-small">
      <template v-if="responsible.length">
        <span>责任人：{{ responsible.map((u) => u.name).join('、') }}</span>
        <span class="text-muted">人均 {{ formatShare(perUser) }} 分</span>
      </template>
      <span v-else class="warn"
        >命中床位成员均请假，个人不承担（宿舍仍扣 {{ BED_POOL_POINTS }} 分）</span
      >
    </div>
  </div>
</template>

<style scoped>
.pool-picker {
  padding: var(--space-4);
  border: 1px solid var(--md-outline-variant);
  border-radius: var(--shape-lg);
  background: var(--md-surface-container-lowest);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  transition: border-color var(--motion-fast) var(--ease-standard);
}
.pool-picker.active {
  border-color: var(--md-primary);
  background: color-mix(in srgb, var(--md-primary) 6%, var(--md-surface-container-lowest));
}
.pool-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.pool-points {
  font-size: var(--text-label-medium);
  color: var(--md-on-surface-variant);
}
.pool-points.on {
  color: var(--md-primary);
  font-weight: var(--weight-semibold);
}
.bed-options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.bed-chip {
  min-width: 62px;
  justify-content: center;
}
.pool-responsible {
  display: flex;
  flex-wrap: wrap;
  gap: 4px var(--space-4);
  color: var(--md-on-surface-variant);
}
.pool-responsible .warn {
  color: var(--md-error);
}
</style>
