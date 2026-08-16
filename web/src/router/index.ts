import { createRouter, createWebHistory } from 'vue-router';
import type { Role } from '../api/types';
import { useAuthStore } from '../stores/auth';
import LoginView from '../views/LoginView.vue';
import DisplayView from '../views/DisplayView.vue';
import AdminLayout from '../views/admin/AdminLayout.vue';
import EntryView from '../views/admin/EntryView.vue';
import HistoryView from '../views/admin/HistoryView.vue';
import LogsView from '../views/admin/LogsView.vue';
import SettingsView from '../views/admin/SettingsView.vue';

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean;
    roles?: Role[];
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/', name: 'display', component: DisplayView, meta: { roles: ['VIEWER', 'ADMIN'] } },
    {
      path: '/admin',
      component: AdminLayout,
      redirect: '/admin/entry',
      meta: { roles: ['ADMIN'] },
      children: [
        { path: 'entry', name: 'admin-entry', component: EntryView, meta: { roles: ['ADMIN'] } },
        {
          path: 'history',
          name: 'admin-history',
          component: HistoryView,
          meta: { roles: ['ADMIN'] },
        },
        { path: 'logs', name: 'admin-logs', component: LogsView, meta: { roles: ['ADMIN'] } },
        {
          path: 'settings',
          name: 'admin-settings',
          component: SettingsView,
          meta: { roles: ['ADMIN'] },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.ensureLoaded();
  const role = auth.role;

  if (to.meta.public) {
    // 已登录时访问登录页，按角色回跳
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
