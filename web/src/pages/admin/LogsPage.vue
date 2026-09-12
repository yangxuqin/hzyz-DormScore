<!-- 管理 · 操作日志 -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { AuditAction, AuditLog } from '@dorm/contracts';
import { errorMessage } from '../../api/client';
import { adminApi } from '../../api/endpoints';
import { formatDateTime } from '../../utils/date';
import MButton from '../../components/ui/MButton.vue';
import MCard from '../../components/ui/MCard.vue';
import MStateBox from '../../components/ui/MStateBox.vue';

const LIMIT = 50;

const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: '新增',
  UPDATE: '修改',
  REVOKE: '撤回',
  RESTORE: '恢复',
  CHANGE_PASSWORD: '修改密码',
  UPDATE_CONFIG: '修改配置',
};

function actionBadge(action: AuditAction): string {
  if (action === 'CREATE') return 'm-badge--success';
  if (action === 'UPDATE') return 'm-badge--primary';
  if (action === 'REVOKE') return 'm-badge--danger';
  if (action === 'RESTORE') return 'm-badge--warning';
  return '';
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
    const data = await adminApi.auditLogs(LIMIT, offset.value);
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
    <div class="page-header">
      <h2 class="page-title">操作日志</h2>
      <span class="text-muted type-body-small"
        >共 {{ total }} 条 · 第 {{ page }} / {{ totalPages }} 页</span
      >
    </div>

    <MStateBox
      :loading="loading"
      :error="error"
      :empty="!loading && !error && logs.length === 0"
      empty-text="暂无操作日志"
      @retry="load"
    >
      <div class="log-list">
        <MCard v-for="log in logs" :key="log.id" variant="elevated" class="log-card">
          <div class="log-head">
            <span class="m-badge" :class="actionBadge(log.action)">{{
              ACTION_LABELS[log.action]
            }}</span>
            <span class="log-target type-title-small">{{ log.target }}</span>
            <span class="log-time text-muted type-body-small">{{
              formatDateTime(log.createdAt)
            }}</span>
          </div>
          <div class="log-meta type-body-small text-muted">
            <span>操作人：{{ log.operator }}</span>
            <span v-if="log.reason">原因：{{ log.reason }}</span>
          </div>
          <details class="log-details">
            <summary>查看修改前后数据</summary>
            <div class="log-diff">
              <div>
                <div class="section-label">修改前</div>
                <pre class="log-json">{{ formatJson(log.beforeJson) }}</pre>
              </div>
              <div>
                <div class="section-label">修改后</div>
                <pre class="log-json">{{ formatJson(log.afterJson) }}</pre>
              </div>
            </div>
          </details>
        </MCard>
      </div>

      <div class="pagination">
        <MButton variant="outlined" size="sm" :disabled="!canPrev" @click="prevPage"
          >上一页</MButton
        >
        <span class="text-muted type-body-medium">{{ page }} / {{ totalPages }}</span>
        <MButton variant="outlined" size="sm" :disabled="!canNext" @click="nextPage"
          >下一页</MButton
        >
      </div>
    </MStateBox>
  </div>
</template>

<style scoped>
.log-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.log-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.log-time {
  margin-left: auto;
}
.log-meta {
  display: flex;
  gap: var(--space-5);
  flex-wrap: wrap;
  margin-top: var(--space-2);
}
.log-details {
  margin-top: var(--space-3);
  font-size: var(--text-body-small);
}
.log-details summary {
  cursor: pointer;
  color: var(--md-primary);
}
.log-diff {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
  margin-top: var(--space-3);
}
.log-json {
  margin: 4px 0 0;
  padding: var(--space-3);
  background: var(--md-surface-container);
  border-radius: var(--shape-md);
  font-size: 12px;
  line-height: 1.5;
  max-height: 260px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-5);
  margin-top: var(--space-4);
}
@media (min-width: 768px) {
  .log-diff {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
