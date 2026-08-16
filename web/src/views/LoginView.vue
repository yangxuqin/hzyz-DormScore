<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ApiError, apiPost } from '../api/client';
import { useAuthStore } from '../stores/auth';
import ThemeToggle from '../components/ThemeToggle.vue';
import type { Role } from '../api/types';

const router = useRouter();
const auth = useAuthStore();

const activeTab = ref<'VIEWER' | 'ADMIN'>('VIEWER');
const password = ref('');
const loading = ref(false);
const error = ref('');
const lockHint = ref('');

function switchTab(tab: 'VIEWER' | 'ADMIN'): void {
  activeTab.value = tab;
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
    const data = await apiPost<{ role: Role }>('/auth/login', {
      role: activeTab.value,
      password: password.value,
    });
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
    <div class="login-theme">
      <ThemeToggle />
    </div>
    <div class="login-card card">
      <div class="login-brand">宿舍分数系统</div>
      <p class="login-sub">宿舍卫生与纪律检查 · 分数可视化</p>

      <div class="tabs" role="tablist">
        <button
          type="button"
          class="tab"
          :class="{ active: activeTab === 'VIEWER' }"
          @click="switchTab('VIEWER')"
        >
          展示入口
        </button>
        <button
          type="button"
          class="tab"
          :class="{ active: activeTab === 'ADMIN' }"
          @click="switchTab('ADMIN')"
        >
          管理入口
        </button>
      </div>

      <form class="login-form" @submit.prevent="submit">
        <div class="form-field">
          <label class="form-label" for="login-password">
            {{ activeTab === 'VIEWER' ? '展示密码' : '管理密码' }}
          </label>
          <input
            id="login-password"
            v-model="password"
            type="password"
            class="input"
            :placeholder="activeTab === 'VIEWER' ? '请输入展示密码' : '请输入管理密码'"
            autocomplete="current-password"
            autofocus
          />
        </div>
        <div v-if="error" class="banner banner-error">{{ error }}</div>
        <div v-if="lockHint" class="banner banner-warning">{{ lockHint }}</div>
        <button type="submit" class="btn btn-primary btn-lg btn-block" :disabled="loading">
          {{ loading ? '登录中…' : '登录' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: linear-gradient(160deg, #2563eb 0%, #1e40af 100%);
}

[data-theme='dark'] .login-page {
  background: linear-gradient(160deg, #0b1220 0%, #16213a 100%);
}

.login-theme {
  position: fixed;
  top: 14px;
  right: 14px;
  z-index: 10;
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 28px 24px;
}

.login-brand {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
  text-align: center;
}

.login-sub {
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
  margin: 6px 0 20px;
}

.tabs {
  display: flex;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 4px;
  margin-bottom: 20px;
}

.tab {
  flex: 1;
  min-height: 42px;
  border: none;
  background: transparent;
  border-radius: 999px;
  color: var(--color-text-secondary);
  font-size: 15px;
}

.tab.active {
  background: var(--color-card);
  color: var(--color-primary);
  font-weight: 600;
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.1);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.login-form .btn {
  margin-top: 8px;
}
</style>
