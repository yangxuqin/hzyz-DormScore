<!-- MD3E 分段控件 -->
<script setup lang="ts">
defineProps<{
  options: { value: string; label: string }[];
  modelValue: string;
  block?: boolean;
}>();
defineEmits<{ (e: 'update:modelValue', value: string): void }>();
</script>

<template>
  <div class="m-segmented" :class="{ 'm-segmented--block': block }" role="tablist">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="tab"
      :aria-selected="modelValue === opt.value"
      :class="{ active: modelValue === opt.value }"
      @click="$emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
