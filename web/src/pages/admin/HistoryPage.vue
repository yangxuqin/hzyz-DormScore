<!-- 管理 · 历史记录 -->
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { AppConfig, EnrichedRecord, SaveInspectionBody } from '@dorm/contracts';
import { errorMessage } from '../../api/client';
import { adminApi, configApi } from '../../api/endpoints';
import { showToast } from '../../composables/useToast';
import {
  currentMonthInShanghai,
  currentWeekRange,
  lastDayOfMonth,
  todayInShanghai,
} from '../../utils/date';
import { exportRecordsCsv } from '../../features/history/exportRecordsCsv';
import MButton from '../../components/ui/MButton.vue';
import MCard from '../../components/ui/MCard.vue';
import MIcon from '../../components/ui/MIcon.vue';
import MModal from '../../components/ui/MModal.vue';
import MSegmented from '../../components/ui/MSegmented.vue';
import MStateBox from '../../components/ui/MStateBox.vue';
import HistoryRecordCard from '../../features/history/HistoryRecordCard.vue';

type FilterMode = 'month' | 'week' | 'range';

const FILTERS = [
  { value: 'month', label: '本月' },
  { value: 'week', label: '本周' },
  { value: 'range', label: '自定义' },
];

const config = ref<AppConfig | null>(null);
const filterMode = ref<FilterMode>('month');
const monthValue = ref(currentMonthInShanghai());
const rangeFrom = ref('');
const rangeTo = ref('');
const today = todayInShanghai();

const records = ref<EnrichedRecord[]>([]);
const loading = ref(false);
const error = ref('');
const saving = ref(false);
const week = currentWeekRange();

const actionDialog = ref<{
  record: EnrichedRecord;
  action: 'revoke' | 'restore';
  reason: string;
} | null>(null);
const actionSubmitting = ref(false);

let loadSeq = 0;

function buildQuery(): { from: string; to: string } {
  if (filterMode.value === 'month') {
    return { from: `${monthValue.value}-01`, to: lastDayOfMonth(monthValue.value) };
  }
  if (filterMode.value === 'week') return { from: week.start, to: week.end };
  return { from: rangeFrom.value, to: rangeTo.value };
}

async function load(): Promise<void> {
  const query = buildQuery();
  if (filterMode.value === 'range' && (!query.from || !query.to)) {
    records.value = [];
    return;
  }
  const seq = ++loadSeq;
  loading.value = true;
  error.value = '';
  try {
    const data = await adminApi.listInspections(query.from, query.to);
    if (seq === loadSeq) records.value = data.records;
  } catch (e) {
    if (seq === loadSeq) error.value = errorMessage(e, '历史记录加载失败');
  } finally {
    if (seq === loadSeq) loading.value = false;
  }
}

async function loadConfig(): Promise<void> {
  try {
    config.value = await configApi.get();
  } catch {
    config.value = null;
  }
}

watch(filterMode, () => void load());
watch(monthValue, () => {
  if (filterMode.value === 'month') void load();
});

async function onSave(body: SaveInspectionBody): Promise<void> {
  saving.value = true;
  try {
    await adminApi.saveInspection(body);
    showToast('修改已保存', 'success');
    await load();
  } catch (e) {
    showToast(errorMessage(e, '保存失败'), 'error');
  } finally {
    saving.value = false;
  }
}

function openAction(record: EnrichedRecord): void {
  actionDialog.value = {
    record,
    action: record.status === 'ACTIVE' ? 'revoke' : 'restore',
    reason: '',
  };
}

async function confirmAction(): Promise<void> {
  const dialog = actionDialog.value;
  if (!dialog) return;
  actionSubmitting.value = true;
  try {
    const fn = dialog.action === 'revoke' ? adminApi.revoke : adminApi.restore;
    await fn(dialog.record.id, dialog.reason.trim());
    showToast(dialog.action === 'revoke' ? '已撤回该记录' : '已恢复该记录', 'success');
    actionDialog.value = null;
    await load();
  } catch (e) {
    showToast(errorMessage(e, '操作失败'), 'error');
  } finally {
    actionSubmitting.value = false;
  }
}

// 导出当前筛选结果为 CSV；无记录时给出提示而不是下载空文件
function exportCsv(): void {
  if (records.value.length === 0) {
    showToast('当前筛选无记录，无法导出', 'info');
    return;
  }
  const { from, to } = buildQuery();
  exportRecordsCsv(records.value, from && to ? `${from}_${to}` : '');
  showToast(`已导出 ${records.value.length} 条记录`, 'success');
}

onMounted(() => {
  void loadConfig();
  void load();
});
</script>

<template>
  <div class="page page-stack">
    <div class="page-header">
      <h2 class="page-title">历史记录</h2>
      <MButton
        variant="tonal"
        size="sm"
        :disabled="loading || records.length === 0"
        @click="exportCsv"
      >
        <template #icon><MIcon name="download" :size="16" /></template>
        导出 CSV
      </MButton>
    </div>

    <MCard variant="elevated" class="filter-bar">
      <MSegmented v-model="filterMode" :options="FILTERS" block />
      <div v-if="filterMode === 'month'" class="filter-field">
        <input type="month" class="m-input" v-model="monthValue" :max="currentMonthInShanghai()" />
      </div>
      <div v-else-if="filterMode === 'range'" class="filter-field filter-range">
        <input type="date" class="m-input" v-model="rangeFrom" :max="today" aria-label="开始日期" />
        <span class="text-muted type-body-small">至</span>
        <input type="date" class="m-input" v-model="rangeTo" :max="today" aria-label="结束日期" />
        <MButton size="sm" @click="load">查询</MButton>
      </div>
      <div v-else class="text-muted type-body-small">本周：{{ week.start }} ~ {{ week.end }}</div>
    </MCard>

    <MStateBox
      :loading="loading"
      :error="error"
      :empty="!loading && !error && records.length === 0"
      empty-text="该范围内暂无记录"
      @retry="load"
    >
      <div class="history-list">
        <HistoryRecordCard
          v-for="r in records"
          :key="r.id"
          :record="r"
          :config="config"
          :saving="saving"
          @save="onSave"
          @toggle-status="openAction"
        />
      </div>
    </MStateBox>

    <MModal
      v-if="actionDialog"
      :title="actionDialog.action === 'revoke' ? '撤回记录' : '恢复记录'"
      @close="actionDialog = null"
    >
      <p class="m-hint">
        {{
          actionDialog.action === 'revoke'
            ? '撤回后该日将不参与任何统计，原始数据保留。'
            : '恢复后该日将重新参与统计。'
        }}
      </p>
      <div class="m-field" style="margin-top: var(--space-4)">
        <label class="m-field-label" for="action-reason">原因（可选）</label>
        <textarea
          id="action-reason"
          v-model="actionDialog.reason"
          class="m-textarea"
          rows="2"
          placeholder="填写操作原因，便于追溯"
        />
      </div>
      <template #actions>
        <MButton variant="text" @click="actionDialog = null">取消</MButton>
        <MButton
          :variant="actionDialog.action === 'revoke' ? 'danger' : 'filled'"
          :disabled="actionSubmitting"
          @click="confirmAction"
        >
          {{ actionDialog.action === 'revoke' ? '确认撤回' : '确认恢复' }}
        </MButton>
      </template>
    </MModal>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.filter-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.filter-range {
  flex-direction: row;
  align-items: center;
}
.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
@media (min-width: 768px) {
  .filter-field {
    flex-direction: row;
    align-items: center;
  }
}
</style>
