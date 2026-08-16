import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { setUnauthorizedHandler } from './api/client';
import { useAuthStore } from './stores/auth';
import './styles/base.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);

// 任意接口收到 401 UNAUTHORIZED：清空会话并跳转登录页
setUnauthorizedHandler(() => {
  const auth = useAuthStore();
  auth.invalidate();
  if (router.currentRoute.value.path !== '/login') {
    void router.push({ path: '/login' });
  }
});

app.mount('#app');
