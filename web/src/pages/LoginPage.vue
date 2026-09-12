<!-- 登录页：展示 / 管理双入口，MD3E 风格 -->
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import type { Role } from '@dorm/contracts';
import { ApiError } from '../api/client';
import { authApi } from '../api/endpoints';
import { useAuthStore } from '../stores/auth';
import MButton from '../components/ui/MButton.vue';
import MIcon from '../components/ui/MIcon.vue';
import MSegmented from '../components/ui/MSegmented.vue';
import MThemeToggle from '../components/ui/MThemeToggle.vue';

const router = useRouter();
const auth = useAuthStore();

const activeTab = ref<'VIEWER' | 'ADMIN'>('VIEWER');
const password = ref('');
const loading = ref(false);
const error = ref('');
const lockHint = ref('');

const TABS = [
  { value: 'VIEWER', label: '展示入口' },
  { value: 'ADMIN', label: '管理入口' },
];

function switchTab(tab: string): void {
  activeTab.value = tab as Role;
  password.value = '';
  error.value = '';
  lockHint.value = '';
}

async function submit(): Promise<void> {
  if (!password.value) {
    error.value = '请输入密码';
    return;
  }
  loading.value = true;
  error.value = '';
  lockHint.value = '';
  try {
    const data = await authApi.login({ role: activeTab.value, password: password.value });
    auth.setRole(data.role);
    await router.push(data.role === 'ADMIN' ? '/admin/entry' : '/');
  } catch (e) {
    if (e instanceof ApiError) {
      error.value = e.message;
      if (e.code === 'RATE_LIMITED') {
        lockHint.value = '登录尝试次数过多，已被锁定，请稍后再试';
      }
    } else {
      error.value = '登录失败，请重试';
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-theme"><MThemeToggle /></div>

    <div class="login-card">
      <div class="login-hero">
        <div class="login-logo"><MIcon name="sparkle" :size="30" :stroke-width="1.6" /></div>
        <h1 class="login-brand">DormScore</h1>
        <p class="login-sub">宿舍卫生与纪律检查 · 分数可视化</p>
      </div>

      <MSegmented :model-value="activeTab" :options="TABS" block @update:model-value="switchTab" />

      <form class="login-form" @submit.prevent="submit">
        <div class="m-field">
          <label class="m-field-label" for="login-password">
            {{ activeTab === 'VIEWER' ? '展示密码' : '管理密码' }}
          </label>
          <input
            id="login-password"
            v-model="password"
            type="password"
            class="m-input"
            :placeholder="activeTab === 'VIEWER' ? '请输入展示密码' : '请输入管理密码'"
            autocomplete="current-password"
          />
        </div>
        <div v-if="error" class="m-banner m-banner--error">{{ error }}</div>
        <div v-if="lockHint" class="m-banner m-banner--warning">{{ lockHint }}</div>
        <MButton type="submit" size="lg" block :disabled="loading">
          <template #icon><MIcon name="lock" :size="18" /></template>
          {{ loading ? '登录中…' : '登录' }}
        </MButton>
      </form>

      <p class="login-foot type-body-small text-muted">
        展示入口仅可查看数据；管理入口可录入与维护记录。
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background:
    radial-gradient(120% 90% at 15% 0%, var(--md-primary-container) 0%, transparent 55%),
    radial-gradient(110% 90% at 100% 100%, var(--md-tertiary-container) 0%, transparent 50%),
    var(--md-surface);
}
.login-theme {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: 10;
}
.login-card {
  width: 100%;
  max-width: 420px;
  padding: var(--space-8) var(--space-6);
  background: var(--md-surface-container-lowest);
  border-radius: var(--shape-hero);
  box-shadow: var(--elev-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  animation: fade-up var(--motion-slow) var(--ease-decelerate);
}
.login-hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}
.login-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: var(--shape-2xl);
  background: var(--md-primary-container);
  color: var(--md-on-primary-container);
  margin-bottom: var(--space-2);
}
.login-brand {
  font-size: var(--text-display-small);
  font-weight: var(--weight-bold);
  letter-spacing: -0.02em;
}
.login-sub {
  font-size: var(--text-body-medium);
  color: var(--md-on-surface-variant);
}
.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.login-foot {
  text-align: center;
}
</style>
