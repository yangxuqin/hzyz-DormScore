<!-- MD3E 卡片：elevated / filled / outlined / hero -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'elevated' | 'filled' | 'outlined' | 'hero';
    interactive?: boolean;
    as?: string;
  }>(),
  { variant: 'outlined', interactive: false, as: 'section' },
);
</script>

<template>
  <component
    :is="as"
    class="m-card"
    :class="[`m-card--${variant}`, { 'm-card--interactive': interactive }]"
  >
    <slot />
  </component>
</template>
