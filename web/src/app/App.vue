<!-- 应用根组件 -->
<script setup lang="ts">
import ToastHost from '../components/feedback/ToastHost.vue';
</script>

<template>
  <router-view />
  <ToastHost />
</template>
