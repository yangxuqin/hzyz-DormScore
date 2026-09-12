<!-- 管理后台布局：桌面 Navigation Rail / 手机 Navigation Bar -->
<script setup lang="ts">
import { ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import MIcon from '../components/ui/MIcon.vue';
import MThemeToggle from '../components/ui/MThemeToggle.vue';
import type { IconName } from '../components/ui/MIcon.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const drawerOpen = ref(false);

watch(
  () => route.fullPath,
  () => {
    drawerOpen.value = false;
  },
);

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/admin/entry', label: '录入', icon: 'entry' },
  { to: '/admin/history', label: '历史', icon: 'history' },
  { to: '/admin/logs', label: '日志', icon: 'logs' },
  { to: '/admin/settings', label: '设置', icon: 'settings' },
];

async function logout(): Promise<void> {
  await auth.logout();
  await router.push('/login');
}
</script>

<template>
  <div class="admin-layout">
    <!-- 桌面端 Navigation Rail -->
    <aside class="admin-rail">
      <RouterLink to="/" class="rail-brand" title="DormScore">
        <MIcon name="sparkle" :size="24" />
      </RouterLink>
      <nav class="rail-nav">
        <RouterLink v-for="item in NAV" :key="item.to" :to="item.to" class="rail-link">
          <MIcon :name="item.icon" :size="22" />
          <span class="rail-label">{{ item.label }}</span>
        </RouterLink>
      </nav>
      <div class="rail-foot">
        <MThemeToggle />
        <button class="rail-link" type="button" @click="logout">
          <MIcon name="logout" :size="20" />
          <span class="rail-label">退出</span>
        </button>
      </div>
    </aside>

    <div class="admin-body">
      <header class="admin-topbar">
        <div class="brand">
          <MIcon name="sparkle" :size="20" />
          <span>DormScore 管理</span>
        </div>
        <div class="topbar-actions">
          <RouterLink to="/" class="m-btn m-btn--text m-btn--sm">
            <MIcon name="display" :size="16" /> 展示页
          </RouterLink>
          <MThemeToggle />
        </div>
      </header>

      <main class="admin-main">
        <RouterView />
      </main>

      <!-- 手机端 Navigation Bar -->
      <nav class="admin-bottom-nav" aria-label="管理导航">
        <RouterLink v-for="item in NAV" :key="item.to" :to="item.to" class="bottom-link">
          <MIcon :name="item.icon" :size="22" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100dvh;
  background: var(--md-surface);
}
.admin-rail {
  display: none;
}
.admin-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.admin-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: color-mix(in srgb, var(--md-surface) 88%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--md-outline-variant);
}
.brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-title-medium);
  font-weight: var(--weight-semibold);
  color: var(--md-on-surface);
}
.brand svg {
  color: var(--md-primary);
}
.topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.topbar-actions a {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--md-primary);
}
.admin-main {
  flex: 1;
  padding: var(--space-4);
  padding-bottom: calc(var(--nav-bar-height) + var(--safe-bottom) + var(--space-6));
}
.admin-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: var(--md-surface-container);
  border-top: 1px solid var(--md-outline-variant);
  padding-bottom: var(--safe-bottom);
  z-index: 30;
}
.bottom-link {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: var(--nav-bar-height);
  color: var(--md-on-surface-variant);
  font-size: var(--text-label-small);
}
.bottom-link.router-link-active {
  color: var(--md-primary);
  font-weight: var(--weight-semibold);
}
.bottom-link.router-link-active svg {
  background: var(--md-secondary-container);
  border-radius: var(--shape-full);
  padding: 2px 10px;
  box-sizing: content-box;
}

@media (min-width: 1024px) {
  .admin-rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: var(--nav-rail-width);
    flex-shrink: 0;
    background: var(--md-surface-container);
    border-right: 1px solid var(--md-outline-variant);
    padding: var(--space-4) var(--space-2);
    position: sticky;
    top: 0;
    height: 100dvh;
  }
  .rail-brand {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: var(--shape-lg);
    background: var(--md-primary-container);
    color: var(--md-on-primary-container);
    margin-bottom: var(--space-6);
  }
  .rail-nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    flex: 1;
    width: 100%;
  }
  .rail-link {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 100%;
    min-height: 64px;
    justify-content: center;
    border: none;
    background: transparent;
    border-radius: var(--shape-lg);
    color: var(--md-on-surface-variant);
    font-size: var(--text-label-small);
    transition:
      background var(--motion-fast) var(--ease-standard),
      color var(--motion-fast) var(--ease-standard);
  }
  .rail-link:hover {
    background: var(--md-surface-container-high);
  }
  .rail-link.router-link-active {
    background: var(--md-secondary-container);
    color: var(--md-on-secondary-container);
    font-weight: var(--weight-semibold);
  }
  .rail-foot {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
    align-items: center;
  }
  .admin-topbar {
    display: none;
  }
  .admin-bottom-nav {
    display: none;
  }
  .admin-main {
    padding: var(--space-6);
    padding-bottom: var(--space-6);
  }
}
</style>
