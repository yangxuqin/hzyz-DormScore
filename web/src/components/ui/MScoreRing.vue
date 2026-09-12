<!-- 分数环：今日得分的大数字视觉层级 -->
<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    score: number | null;
    max?: number;
    size?: number;
  }>(),
  { max: 20, size: 132 },
);

const pct = computed(() => {
  if (props.score === null) return 0;
  return Math.max(0, Math.min(1, props.score / props.max));
});

const stroke = 10;
const radius = computed(() => (props.size - stroke) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);
const dash = computed(() => `${circumference.value * pct.value} ${circumference.value}`);

const tier = computed(() => {
  const s = props.score;
  if (s === null) return 'none';
  if (s >= 20) return 'excellent';
  if (s >= 15) return 'good';
  if (s >= 10) return 'fair';
  if (s >= 5) return 'poor';
  return 'critical';
});
</script>

<template>
  <div class="score-ring" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" aria-hidden="true">
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        stroke="var(--md-surface-container-high)"
        :stroke-width="stroke"
      />
      <circle
        class="progress"
        :class="`tier-${tier}`"
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        stroke="currentColor"
        :stroke-width="stroke"
        stroke-linecap="round"
        :stroke-dasharray="dash"
        :transform="`rotate(-90 ${size / 2} ${size / 2})`"
      />
    </svg>
    <div class="ring-content">
      <div class="ring-value numeric" :class="`tier-${tier}`">
        {{ score === null ? '-' : score }}
      </div>
      <div class="ring-max type-body-small">/ {{ max }}</div>
    </div>
  </div>
</template>

<style scoped>
.score-ring {
  position: relative;
  flex-shrink: 0;
}
.progress {
  transition: stroke-dasharray var(--motion-slow) var(--ease-decelerate);
}
.tier-excellent,
.tier-good {
  color: var(--score-excellent);
}
.tier-fair {
  color: var(--score-fair);
}
.tier-poor {
  color: var(--score-poor);
}
.tier-critical {
  color: var(--score-critical);
}
.tier-none {
  color: var(--md-on-surface-variant);
}
.ring-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
}
.ring-value {
  font-size: 2.5rem;
  font-weight: var(--weight-bold);
  line-height: 1;
  color: var(--md-on-surface);
}
.ring-max {
  color: var(--md-on-surface-variant);
}
</style>
