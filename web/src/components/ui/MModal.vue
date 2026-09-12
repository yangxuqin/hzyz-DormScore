<!-- MD3E 对话框（移动端底部抽屉 / 桌面端居中） -->
<script setup lang="ts">
import MButton from './MButton.vue';

defineProps<{ title?: string }>();
const emit = defineEmits<{ (e: 'close'): void }>();
</script>

<template>
  <div class="m-dialog-mask" @click.self="emit('close')">
    <div class="m-dialog" role="dialog" aria-modal="true">
      <h3 v-if="title" class="type-title-large" style="margin-bottom: var(--space-2)">
        {{ title }}
      </h3>
      <slot />
      <div class="m-dialog-actions">
        <slot name="actions">
          <MButton variant="text" @click="emit('close')">关闭</MButton>
        </slot>
      </div>
    </div>
  </div>
</template>
