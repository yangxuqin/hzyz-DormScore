<!-- 状态盒：Loading / Empty / Error+Retry，三态统一 -->
<script setup lang="ts">
import MButton from './MButton.vue';
import MIcon from './MIcon.vue';

withDefaults(
  defineProps<{
    loading?: boolean;
    error?: string;
    empty?: boolean;
    emptyText?: string;
    loadingText?: string;
  }>(),
  { emptyText: '暂无数据', loadingText: '加载中…' },
);

defineEmits<{ (e: 'retry'): void }>();
</script>

<template>
  <div v-if="loading" class="m-state">
    <span class="m-spinner" aria-hidden="true" />
    <span class="type-body-medium">{{ loadingText }}</span>
  </div>
  <div v-else-if="error" class="m-state m-state--error">
    <MIcon name="alert" :size="26" />
    <span class="type-body-medium">{{ error }}</span>
    <MButton variant="outlined" size="sm" @click="$emit('retry')">重试</MButton>
  </div>
  <div v-else-if="empty" class="m-state">
    <MIcon name="info" :size="26" />
    <span class="type-body-medium">{{ emptyText }}</span>
  </div>
  <slot v-else />
</template>
