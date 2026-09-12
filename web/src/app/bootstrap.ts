// 401 会话失效处理：全应用唯一入口，避免无限重定向
import router from '../router';
import { useAuthStore } from '../stores/auth';

/**
 * 注册到 API 客户端。收到 401 UNAUTHORIZED 时：
 * 1. 清空本地会话；
 * 2. 若当前不在登录页，跳转一次登录页。
 * 已在登录页时只清空会话、不跳转，杜绝循环。
 */
export function installUnauthorizedHandler(): void {
  const auth = useAuthStore();
  auth.invalidate();
  const current = router.currentRoute.value;
  if (current.path !== '/login') {
    void router.push({ path: '/login', query: { redirect: current.fullPath } });
  }
}
