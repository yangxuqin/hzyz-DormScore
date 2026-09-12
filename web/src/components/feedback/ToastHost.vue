<!-- Toast 宿主：挂在应用根部，绑定到全局 toast 队列 -->
<script setup lang="ts">
import { useToast } from '../../composables/useToast';

const { toasts } = useToast();
</script>

<template>
  <Teleport to="body">
    <div class="m-toast-host" aria-live="polite">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="m-toast"
        :class="{ 'm-toast--success': t.kind === 'success', 'm-toast--error': t.kind === 'error' }"
      >
        {{ t.message }}
      </div>
    </div>
  </Teleport>
</template>
