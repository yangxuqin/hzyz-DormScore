import { defineStore } from 'pinia';
import { apiGet, apiPost } from '../api/client';
import type { Role } from '../api/types';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    role: null as Role | null,
    loaded: false,
    loading: false,
  }),
  actions: {
    /** 确保会话已确认（GET /api/auth/me），store 缓存角色 */
    async ensureLoaded(): Promise<Role | null> {
      if (this.loaded) return this.role;
      this.loading = true;
      try {
        const data = await apiGet<{ role: Role | null }>('/auth/me');
        this.role = data.role;
      } catch {
        this.role = null;
      } finally {
        this.loading = false;
        this.loaded = true;
      }
      return this.role;
    },
    setRole(role: Role | null): void {
      this.role = role;
      this.loaded = true;
    },
    /** 会话失效（401）时清空并强制下次重新确认 */
    invalidate(): void {
      this.role = null;
      this.loaded = false;
    },
    async logout(): Promise<void> {
      try {
        await apiPost<null>('/auth/logout');
      } catch {
        // 忽略注销接口错误，本地会话照常清理
      }
      this.role = null;
      this.loaded = false;
    },
  },
});
