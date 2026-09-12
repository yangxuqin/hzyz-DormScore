// 主题（明亮 / 暗夜）：localStorage 持久化，默认跟随系统 prefers-color-scheme
import { defineStore } from 'pinia';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'dorm.theme';

function initialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const useThemeStore = defineStore('theme', {
  state: () => ({ theme: 'light' as Theme }),
  actions: {
    /** 应用启动时调用：读取偏好并应用到 <html data-theme> */
    init(): void {
      this.theme = initialTheme();
      this.apply();
    },
    toggle(): void {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem(STORAGE_KEY, this.theme);
      this.apply();
    },
    apply(): void {
      document.documentElement.dataset.theme = this.theme;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', this.theme === 'dark' ? '#0f1512' : '#f6faf6');
    },
  },
});
