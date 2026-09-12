// 全局轻量 Toast：模块级响应式队列，供任意页面调用
import { readonly, ref } from 'vue';

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

const items = ref<ToastItem[]>([]);
let nextId = 1;

export function showToast(message: string, kind: ToastKind = 'info', duration = 3000): void {
  const id = nextId++;
  items.value.push({ id, message, kind });
  window.setTimeout(() => dismissToast(id), duration);
}

export function dismissToast(id: number): void {
  items.value = items.value.filter((t) => t.id !== id);
}

export function useToast() {
  return { toasts: readonly(items), showToast, dismissToast };
}
