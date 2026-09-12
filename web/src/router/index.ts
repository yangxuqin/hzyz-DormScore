// 路由表：登录页公开；展示页需任意会话；管理页需 ADMIN
import { createRouter, createWebHistory } from 'vue-router';
import type { Role } from '@dorm/contracts';
import { useAuthStore } from '../stores/auth';

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean;
    roles?: Role[];
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../pages/LoginPage.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      name: 'display',
      component: () => import('../pages/DisplayPage.vue'),
      meta: { roles: ['VIEWER', 'ADMIN'] },
    },
    {
      path: '/admin',
      component: () => import('../layouts/AdminLayout.vue'),
      redirect: '/admin/entry',
      meta: { roles: ['ADMIN'] },
      children: [
        {
          path: 'entry',
          name: 'admin-entry',
          component: () => import('../pages/admin/EntryPage.vue'),
          meta: { roles: ['ADMIN'] },
        },
        {
          path: 'history',
          name: 'admin-history',
          component: () => import('../pages/admin/HistoryPage.vue'),
          meta: { roles: ['ADMIN'] },
        },
        {
          path: 'logs',
          name: 'admin-logs',
          component: () => import('../pages/admin/LogsPage.vue'),
          meta: { roles: ['ADMIN'] },
        },
        {
          path: 'settings',
          name: 'admin-settings',
          component: () => import('../pages/admin/SettingsPage.vue'),
          meta: { roles: ['ADMIN'] },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

/**
 * 守卫只读取已确认的会话状态。
 * 应用启动时已完成 GET /auth/me（见 main.ts），此处不再触发认证请求，
 * 因此不会与 auth store 形成循环；跳转均发生在跳转钩子内，天然去重。
 */
router.beforeEach((to) => {
  const auth = useAuthStore();
  const role = auth.role;

  if (to.meta.public) {
    if (to.path === '/login' && role) {
      return role === 'ADMIN' ? '/admin/entry' : '/';
    }
    return true;
  }

  if (!role) {
    return { path: '/login', query: to.path === '/' ? {} : { redirect: to.fullPath } };
  }

  const required = to.meta.roles;
  if (required && !required.includes(role)) {
    return role === 'ADMIN' ? '/admin/entry' : '/';
  }
  return true;
});

export default router;
