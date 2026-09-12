<!-- MD3E 按钮：filled / tonal / outlined / text / danger；支持图标插槽 -->
<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'filled' | 'tonal' | 'outlined' | 'text' | 'danger' | 'danger-outlined';
    size?: 'sm' | 'md' | 'lg';
    type?: 'button' | 'submit';
    disabled?: boolean;
    block?: boolean;
  }>(),
  { variant: 'filled', size: 'md', type: 'button', disabled: false, block: false },
);
</script>

<template>
  <button
    class="m-btn"
    :class="[
      `m-btn--${variant}`,
      `m-btn--${size}`,
      { 'm-btn--block': block, 'm-btn--icon': $slots.icon && !$slots.default },
    ]"
    :type="type"
    :disabled="disabled"
  >
    <slot name="icon" />
    <slot />
  </button>
</template>
