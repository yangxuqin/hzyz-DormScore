// 认证状态：只在应用启动时确认一次会话（GET /auth/me），后续由守卫读取缓存
import { defineStore } from 'pinia';
import type { Role } from '@dorm/contracts';
import { authApi } from '../api/endpoints';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    role: null as Role | null,
    /** 是否已完成一次会话确认（避免守卫重复请求） */
    loaded: false,
  }),
  getters: {
    isAdmin: (state) => state.role === 'ADMIN',
  },
  actions: {
    /**
     * 确保会话已确认。应用启动时调用一次；守卫内仅在未加载时兜底调用，
     * 不会与路由守卫互相触发（不在此处做任何跳转）。
     */
    async ensureLoaded(): Promise<Role | null> {
      if (this.loaded) return this.role;
      try {
        const data = await authApi.me();
        this.role = data.role;
      } catch {
        this.role = null;
      } finally {
        this.loaded = true;
      }
      return this.role;
    },
    setRole(role: Role | null): void {
      this.role = role;
      this.loaded = true;
    },
    /** 会话失效（401）：清空并允许下次重新确认 */
    invalidate(): void {
      this.role = null;
      this.loaded = false;
    },
    async logout(): Promise<void> {
      try {
        await authApi.logout();
      } catch {
        // 忽略注销接口错误，本地会话照常清理
      }
      this.role = null;
      this.loaded = false;
    },
  },
});
