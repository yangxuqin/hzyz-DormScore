<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';

const router = useRouter();
const auth = useAuthStore();

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
        <RouterLink to="/" class="link">查看展示页</RouterLink>
        <button class="btn btn-outline btn-block" @click="logout">退出登录</button>
      </div>
    </aside>

    <div class="admin-body">
      <!-- 移动端顶部栏 -->
      <header class="admin-topbar">
        <div class="brand">宿舍分数管理</div>
        <div class="topbar-actions">
          <RouterLink to="/" class="btn btn-ghost btn-sm">展示页</RouterLink>
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
