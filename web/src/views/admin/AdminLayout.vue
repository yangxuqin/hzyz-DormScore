<script setup lang="ts">
import { ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import ThemeToggle from '../../components/ThemeToggle.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

/** 移动端抽屉侧边栏开关；路由切换后自动收起 */
const drawerOpen = ref(false);

watch(
  () => route.fullPath,
  () => {
    drawerOpen.value = false;
  },
);

async function logout(): Promise<void> {
  await auth.logout();
  await router.push('/login');
}
</script>

<template>
  <div class="admin-layout">
    <!-- 桌面端侧边栏 -->
    <aside class="admin-sidebar">
      <div class="sidebar-brand">宿舍分数管理</div>
      <nav class="sidebar-nav">
        <RouterLink to="/admin/entry" exact-active-class="active">每日录入</RouterLink>
        <RouterLink to="/admin/history" exact-active-class="active">历史记录</RouterLink>
        <RouterLink to="/admin/logs" exact-active-class="active">操作日志</RouterLink>
        <RouterLink to="/admin/settings" exact-active-class="active">设置</RouterLink>
      </nav>
      <div class="sidebar-foot">
        <ThemeToggle />
        <RouterLink to="/" class="link">查看展示页</RouterLink>
        <button class="btn btn-outline btn-block" @click="logout">退出登录</button>
      </div>
    </aside>

    <div class="admin-body">
      <!-- 移动端顶部栏 -->
      <header class="admin-topbar">
        <button class="menu-btn" type="button" aria-label="打开菜单" @click="drawerOpen = true">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <div class="brand">宿舍分数管理</div>
        <div class="topbar-actions">
          <RouterLink to="/" class="btn btn-ghost btn-sm">展示页</RouterLink>
          <ThemeToggle />
          <button class="btn btn-outline btn-sm" @click="logout">退出登录</button>
        </div>
      </header>

      <main class="admin-main">
        <RouterView />
      </main>

      <!-- 移动端底部导航 -->
      <nav class="admin-bottom-nav">
        <RouterLink to="/admin/entry" exact-active-class="active">录入</RouterLink>
        <RouterLink to="/admin/history" exact-active-class="active">历史</RouterLink>
        <RouterLink to="/admin/logs" exact-active-class="active">日志</RouterLink>
        <RouterLink to="/admin/settings" exact-active-class="active">设置</RouterLink>
      </nav>
    </div>

    <!-- 移动端抽屉侧边栏（汉堡菜单打开，等同桌面端左侧栏） -->
    <Teleport to="body">
      <div v-if="drawerOpen" class="drawer-mask" @click="drawerOpen = false" />
      <aside class="drawer" :class="{ open: drawerOpen }" aria-label="管理导航">
        <div class="sidebar-brand">宿舍分数管理</div>
        <nav class="sidebar-nav">
          <RouterLink to="/admin/entry" exact-active-class="active" @click="drawerOpen = false"
            >每日录入</RouterLink
          >
          <RouterLink to="/admin/history" exact-active-class="active" @click="drawerOpen = false"
            >历史记录</RouterLink
          >
          <RouterLink to="/admin/logs" exact-active-class="active" @click="drawerOpen = false"
            >操作日志</RouterLink
          >
          <RouterLink to="/admin/settings" exact-active-class="active" @click="drawerOpen = false"
            >设置</RouterLink
          >
        </nav>
        <div class="sidebar-foot">
          <ThemeToggle />
          <RouterLink to="/" class="link" @click="drawerOpen = false">查看展示页</RouterLink>
          <button class="btn btn-outline btn-block" @click="logout">退出登录</button>
        </div>
      </aside>
    </Teleport>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
}

.admin-sidebar {
  display: none;
}

.admin-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.admin-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: var(--color-card);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 20;
}

.admin-main {
  flex: 1;
  padding: 16px;
  padding-bottom: calc(var(--nav-height) + var(--safe-bottom) + 24px);
}

.admin-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: var(--color-card);
  border-top: 1px solid var(--color-border);
  padding-bottom: var(--safe-bottom);
  z-index: 30;
}

.admin-bottom-nav a {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--nav-height);
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: 14px;
}

.admin-bottom-nav a.active {
  color: var(--color-primary);
  font-weight: 600;
}

/* 侧边栏 / 抽屉共用的导航样式（桌面左栏与移动抽屉同源） */
.sidebar-brand {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-primary);
  padding: 4px 8px 16px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 12px;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.sidebar-nav a {
  display: block;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: 15px;
}

.sidebar-nav a:hover {
  background: var(--color-bg);
}

.sidebar-nav a.active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 600;
}

.sidebar-foot {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}

/* 移动端菜单按钮 */
.menu-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background: var(--color-card);
  color: var(--color-text);
  flex-shrink: 0;
}

/* 移动端抽屉侧边栏 */
.drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 264px;
  max-width: 82vw;
  background: var(--color-card);
  border-right: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  z-index: 40;
  display: flex;
  flex-direction: column;
  padding: 16px;
  transform: translateX(-105%);
  transition: transform 0.25s ease;
}

.drawer.open {
  transform: translateX(0);
}

.drawer-mask {
  position: fixed;
  inset: 0;
  background: rgb(15 23 42 / 0.45);
  z-index: 35;
}

@media (min-width: 768px) {
  .admin-sidebar {
    display: flex;
    flex-direction: column;
    width: 220px;
    flex-shrink: 0;
    background: var(--color-card);
    border-right: 1px solid var(--color-border);
    padding: 16px;
    position: sticky;
    top: 0;
    height: 100vh;
  }

  .menu-btn,
  .drawer,
  .drawer-mask {
    display: none;
  }

  .admin-topbar {
    display: none;
  }

  .admin-bottom-nav {
    display: none;
  }

  .admin-main {
    padding: 24px;
    padding-bottom: 24px;
  }
}
</style>
