// 应用入口：先初始化会话（GET /auth/me）→ 应用主题 → 注册 401 处理器 → 挂载
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './app/App.vue';
import router from './router';
import { setUnauthorizedHandler } from './api/client';
import { installUnauthorizedHandler } from './app/bootstrap';
import { useAuthStore } from './stores/auth';
import { useThemeStore } from './stores/theme';
import './styles/tokens.css';
import './styles/base.css';

async function bootstrap(): Promise<void> {
  const app = createApp(App);
  app.use(createPinia());

  // 主题在挂载前应用，避免首屏闪烁
  useThemeStore().init();

  // 唯一的 401 处理入口
  setUnauthorizedHandler(installUnauthorizedHandler);

  // 会话初始化完成后再让 router 接管：GET /auth/me → Auth Ready → Router Ready → mount
  await useAuthStore().ensureLoaded();

  app.use(router);
  app.mount('#app');
}

void bootstrap();
