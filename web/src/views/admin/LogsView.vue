<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { apiGet, errorMessage } from '../../api/client';
import type { AuditAction, AuditLog, AuditLogsData } from '../../api/types';
import { formatDateTime } from '../../utils/date';
import StateBox from '../../components/StateBox.vue';

const LIMIT = 50;

const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: '新增',
  UPDATE: '修改',
  REVOKE: '撤回',
  RESTORE: '恢复',
  CHANGE_PASSWORD: '修改密码',
  UPDATE_CONFIG: '修改配置',
};

function actionBadgeClass(action: AuditAction): string {
  switch (action) {
    case 'CREATE':
      return 'badge-success';
    case 'UPDATE':
      return 'badge-primary';
    case 'REVOKE':
      return 'badge-danger';
    case 'RESTORE':
      return 'badge-warning';
    default:
      return 'badge-muted';
  }
}

const logs = ref<AuditLog[]>([]);
const total = ref(0);
const offset = ref(0);
const loading = ref(true);
const error = ref('');

const page = computed(() => Math.floor(offset.value / LIMIT) + 1);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / LIMIT)));
const canPrev = computed(() => offset.value > 0);
const canNext = computed(() => offset.value + LIMIT < total.value);

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const data = await apiGet<AuditLogsData>('/admin/audit-logs', {
      limit: LIMIT,
      offset: offset.value,
    });
    logs.value = data.logs;
    total.value = data.total;
  } catch (e) {
    error.value = errorMessage(e, '日志加载失败');
  } finally {
    loading.value = false;
  }
}

function prevPage(): void {
  if (!canPrev.value) return;
  offset.value -= LIMIT;
  void load();
}

function nextPage(): void {
  if (!canNext.value) return;
  offset.value += LIMIT;
  void load();
}

function formatJson(s: string | null): string {
  if (!s) return '（无）';
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

onMounted(() => void load());
</script>

<template>
  <div class="page page-stack">
    <div class="list-header">
      <h2 class="page-title">操作日志</h2>
      <div class="list-header-info">共 {{ total }} 条 · 第 {{ page }} / {{ totalPages }} 页</div>
    </div>

    <StateBox v-if="loading" loading />
    <StateBox v-else-if="error" :error="error" @retry="load" />
    <StateBox v-else-if="logs.length === 0" empty empty-text="暂无操作日志" />

    <div v-else class="log-list">
      <div v-for="log in logs" :key="log.id" class="card log-card">
        <div class="log-head">
          <span class="badge" :class="actionBadgeClass(log.action)">
            {{ ACTION_LABELS[log.action] }}
          </span>
          <span class="log-target">{{ log.target }}</span>
          <span class="log-time">{{ formatDateTime(log.createdAt) }}</span>
        </div>
        <div class="log-meta">
          <span>操作人：{{ log.operator }}</span>
          <span v-if="log.reason">原因：{{ log.reason }}</span>
        </div>
        <details class="log-details">
          <summary>查看修改前后数据</summary>
          <div class="log-diff">
            <div class="log-diff-col">
              <div class="log-diff-title">修改前</div>
              <pre class="log-json">{{ formatJson(log.beforeJson) }}</pre>
            </div>
            <div class="log-diff-col">
              <div class="log-diff-title">修改后</div>
              <pre class="log-json">{{ formatJson(log.afterJson) }}</pre>
            </div>
          </div>
        </details>
      </div>
    </div>

    <div v-if="logs.length > 0" class="pagination">
      <button class="btn btn-ghost btn-sm" :disabled="!canPrev" @click="prevPage">上一页</button>
      <span class="pagination-info">{{ page }} / {{ totalPages }}</span>
      <button class="btn btn-ghost btn-sm" :disabled="!canNext" @click="nextPage">下一页</button>
    </div>
  </div>
</template>

<style scoped>
.list-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.list-header-info {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.log-card {
  padding: 14px;
}

.log-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.log-target {
  font-weight: 600;
  font-size: 14px;
}

.log-time {
  margin-left: auto;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.log-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 6px;
}

.log-details {
  margin-top: 8px;
  font-size: 13px;
}

.log-details summary {
  cursor: pointer;
  color: var(--color-primary);
}

.log-diff {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-top: 8px;
}

.log-diff-title {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.log-json {
  margin: 0;
  padding: 10px;
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  max-height: 260px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.pagination-info {
  font-size: 14px;
  color: var(--color-text-secondary);
}

@media (min-width: 768px) {
  .log-diff {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
