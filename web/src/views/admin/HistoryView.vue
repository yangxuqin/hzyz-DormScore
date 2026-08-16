<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { apiGet, apiPost, errorMessage } from '../../api/client';
import type { Config, EnrichedRecord, Period, SaveInspectionBody } from '../../api/types';
import {
  currentMonthInShanghai,
  currentWeekRange,
  formatDateCn,
  formatDateTime,
  lastDayOfMonth,
  todayInShanghai,
} from '../../utils/date';
import { PERIOD_LABELS, PERIODS } from '../../utils/deduction';
import InspectionForm from '../../components/InspectionForm.vue';
import StateBox from '../../components/StateBox.vue';

type FilterMode = 'month' | 'week' | 'range';

const config = ref<Config | null>(null);
const configLoading = ref(true);
const configError = ref('');

const filterMode = ref<FilterMode>('month');
const monthValue = ref(currentMonthInShanghai());
const rangeFrom = ref('');
const rangeTo = ref('');
const today = todayInShanghai();

const records = ref<EnrichedRecord[]>([]);
const loading = ref(false);
const error = ref('');
const expandedId = ref<number | null>(null);
const editingId = ref<number | null>(null);
const saveError = ref('');
const saving = ref(false);
const toast = ref('');
const toastType = ref<'success' | 'error'>('success');

const actionDialog = ref<{
  id: number;
  action: 'revoke' | 'restore';
  reason: string;
  submitting: boolean;
} | null>(null);

let loadSeq = 0;

function showToast(message: string, type: 'success' | 'error' = 'success'): void {
  toast.value = message;
  toastType.value = type;
  window.setTimeout(() => {
    if (toast.value === message) toast.value = '';
  }, 3000);
}

function buildQuery(): { from: string; to: string } {
  if (filterMode.value === 'month') {
    return { from: `${monthValue.value}-01`, to: lastDayOfMonth(monthValue.value) };
  }
  if (filterMode.value === 'week') {
    const range = currentWeekRange();
    return { from: range.start, to: range.end };
  }
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
    const data = await apiGet<{ records: EnrichedRecord[] }>('/admin/inspections', query);
    if (seq === loadSeq) records.value = data.records;
  } catch (e) {
    if (seq === loadSeq) error.value = errorMessage(e, '历史记录加载失败');
  } finally {
    if (seq === loadSeq) loading.value = false;
  }
}

async function loadConfig(): Promise<void> {
  configLoading.value = true;
  configError.value = '';
  try {
    config.value = await apiGet<Config>('/config');
  } catch (e) {
    configError.value = errorMessage(e, '配置加载失败');
  } finally {
    configLoading.value = false;
  }
}

watch(filterMode, () => {
  expandedId.value = null;
  editingId.value = null;
  saveError.value = '';
  void load();
});

watch(monthValue, () => void load());

watch([rangeFrom, rangeTo], () => {
  if (filterMode.value === 'range') void load();
});

function toggleDetail(id: number): void {
  expandedId.value = expandedId.value === id ? null : id;
  editingId.value = null;
  saveError.value = '';
}

function startEdit(id: number): void {
  editingId.value = id;
  saveError.value = '';
}

function cancelEdit(): void {
  editingId.value = null;
  saveError.value = '';
}

function bedChecksOf(r: EnrichedRecord, period: Period) {
  return r.bedChecks.filter((c) => c.period === period);
}

function publicChecksOf(r: EnrichedRecord, period: Period) {
  return r.publicChecks.filter((c) => c.period === period);
}

async function onEditSubmit(body: SaveInspectionBody): Promise<void> {
  saving.value = true;
  saveError.value = '';
  try {
    const data = await apiPost<{
      record: EnrichedRecord;
      action: 'created' | 'updated' | 'unchanged';
    }>('/admin/inspections', body);
    showToast(
      data.action === 'updated'
        ? '更新成功'
        : data.action === 'created'
          ? '已保存'
          : '数据未发生变化',
    );
    editingId.value = null;
    expandedId.value = null;
    await load();
  } catch (e) {
    saveError.value = errorMessage(e, '保存失败');
    showToast('保存失败', 'error');
  } finally {
    saving.value = false;
  }
}

function openAction(r: EnrichedRecord): void {
  actionDialog.value = {
    id: r.id,
    action: r.status === 'ACTIVE' ? 'revoke' : 'restore',
    reason: '',
    submitting: false,
  };
}

function closeActionDialog(): void {
  actionDialog.value = null;
}

async function confirmAction(): Promise<void> {
  const dialog = actionDialog.value;
  if (!dialog) return;
  dialog.submitting = true;
  try {
    const path = dialog.action === 'revoke' ? 'revoke' : 'restore';
    await apiPost<{ record: EnrichedRecord; action: 'updated' | 'unchanged' }>(
      `/admin/inspections/${dialog.id}/${path}`,
      { reason: dialog.reason.trim() },
    );
    showToast(dialog.action === 'revoke' ? '已撤回该记录' : '已恢复该记录');
    actionDialog.value = null;
    await load();
  } catch (e) {
    showToast(errorMessage(e, '操作失败'), 'error');
  } finally {
    if (actionDialog.value) actionDialog.value.submitting = false;
  }
}

onMounted(() => {
  void loadConfig();
  void load();
});
</script>

<template>
  <div class="page page-stack">
    <h2 class="page-title">历史记录</h2>

    <!-- 筛选 -->
    <div class="card filter-bar">
      <div class="segmented segmented-block">
        <button :class="{ active: filterMode === 'month' }" @click="filterMode = 'month'">
          本月
        </button>
        <button :class="{ active: filterMode === 'week' }" @click="filterMode = 'week'">
          本周
        </button>
        <button :class="{ active: filterMode === 'range' }" @click="filterMode = 'range'">
          自定义
        </button>
      </div>
      <div v-if="filterMode === 'month'" class="filter-field">
        <input type="month" class="input" v-model="monthValue" :max="currentMonthInShanghai()" />
      </div>
      <div v-else-if="filterMode === 'range'" class="filter-field filter-range">
        <input type="date" class="input" v-model="rangeFrom" :max="today" />
        <span class="filter-sep">至</span>
        <input type="date" class="input" v-model="rangeTo" :max="today" />
        <button class="btn btn-primary" @click="load">查询</button>
      </div>
      <div v-else class="filter-hint">
        本周：{{ currentWeekRange().start }} ~ {{ currentWeekRange().end }}
      </div>
    </div>

    <StateBox v-if="loading" loading />
    <StateBox v-else-if="error" :error="error" @retry="load" />
    <StateBox v-else-if="records.length === 0" empty empty-text="该范围内暂无记录" />

    <div v-else class="history-list">
      <div v-for="r in records" :key="r.id" class="card history-card">
        <div
          class="history-row"
          role="button"
          tabindex="0"
          @click="toggleDetail(r.id)"
          @keydown.enter="toggleDetail(r.id)"
        >
          <div class="history-date">
            <strong>{{ formatDateCn(r.date) }}</strong>
            <span class="history-weekday">{{ r.weekday }}</span>
          </div>
          <div class="history-meta">
            <span>值日生：{{ r.dutyUserName }}</span>
            <span>扣分 {{ r.totalDeduction }}</span>
            <span>得分 {{ r.score }}</span>
            <span class="badge" :class="r.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'">
              {{ r.status === 'ACTIVE' ? '有效' : '已撤回' }}
            </span>
          </div>
          <span class="history-arrow">{{ expandedId === r.id ? '收起' : '详情' }}</span>
        </div>

        <div v-if="expandedId === r.id" class="history-detail">
          <div class="detail-grid">
            <div class="detail-block">
              <h4>基本信息</h4>
              <dl>
                <dt>日期</dt>
                <dd>{{ r.date }}（{{ r.weekday }}）</dd>
                <dt>值日生</dt>
                <dd>{{ r.dutyUserName }}</dd>
                <dt>状态</dt>
                <dd>{{ r.status === 'ACTIVE' ? '有效' : '已撤回' }}</dd>
                <dt>创建时间</dt>
                <dd>{{ formatDateTime(r.createdAt) }}</dd>
                <dt>更新时间</dt>
                <dd>{{ formatDateTime(r.updatedAt) }}</dd>
              </dl>
            </div>

            <div class="detail-block">
              <h4>成员状态</h4>
              <div class="status-chips">
                <span
                  v-for="s in r.userStatus"
                  :key="s.userId"
                  class="chip"
                  :class="s.status === 'NORMAL' ? 'chip-ok' : 'chip-warn'"
                >
                  {{ s.userName }} {{ s.status === 'NORMAL' ? '正常' : '请假' }}
                </span>
              </div>
            </div>

            <div v-for="period in PERIODS" :key="period" class="detail-block">
              <h4>{{ PERIOD_LABELS[period] }}</h4>
              <p class="detail-line">讲话次数：{{ period === 'AM' ? r.talkAm : r.talkPm }} 次</p>
              <p class="detail-line">
                床位：
                <template v-if="bedChecksOf(r, period).length">
                  {{
                    bedChecksOf(r, period)
                      .map((c) => `${c.bedName}·${c.itemLabel}`)
                      .join('、')
                  }}
                </template>
                <template v-else>无扣分项</template>
              </p>
              <p class="detail-line">
                公共区域：
                <template v-if="publicChecksOf(r, period).length">
                  {{
                    publicChecksOf(r, period)
                      .map((c) => c.itemLabel)
                      .join('、')
                  }}
                </template>
                <template v-else>无扣分项</template>
              </p>
            </div>

            <div class="detail-block">
              <h4>扣分汇总</h4>
              <dl>
                <dt>床位扣分</dt>
                <dd>{{ r.bedDeduction }} 分</dd>
                <dt>公共区域扣分</dt>
                <dd>{{ r.publicDeduction }} 分</dd>
                <dt>纪律扣分</dt>
                <dd>{{ r.disciplineDeduction }} 分（{{ r.talkCount }} 次讲话）</dd>
                <dt>总扣分</dt>
                <dd>{{ r.totalDeduction }} 分</dd>
                <dt>得分</dt>
                <dd>{{ r.score }} / 20</dd>
              </dl>
            </div>
          </div>

          <div class="detail-actions">
            <button class="btn btn-primary btn-sm" @click="startEdit(r.id)">修改</button>
            <button
              v-if="r.status === 'ACTIVE'"
              class="btn btn-danger-outline btn-sm"
              @click="openAction(r)"
            >
              撤回
            </button>
            <button v-else class="btn btn-outline btn-sm" @click="openAction(r)">恢复</button>
          </div>

          <div v-if="editingId === r.id" class="edit-panel card">
            <div v-if="saveError" class="banner banner-error">{{ saveError }}</div>
            <InspectionForm
              v-if="config"
              :key="r.id"
              :config="config"
              :record="r"
              :saving="saving"
              @submit="onEditSubmit"
            />
            <button class="btn btn-ghost btn-block" @click="cancelEdit">取消修改</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 撤回 / 恢复弹窗 -->
    <div v-if="actionDialog" class="modal-mask" @click.self="closeActionDialog">
      <div class="modal card">
        <h3>{{ actionDialog.action === 'revoke' ? '撤回记录' : '恢复记录' }}</h3>
        <p class="form-hint">
          {{
            actionDialog.action === 'revoke'
              ? '撤回后该日将不参与任何统计，原始数据保留。'
              : '恢复后该日将重新参与统计。'
          }}
        </p>
        <div class="form-field">
          <label class="form-label" for="action-reason">原因（可选）</label>
          <textarea
            id="action-reason"
            v-model="actionDialog.reason"
            class="textarea"
            rows="2"
            placeholder="填写操作原因，便于追溯"
          ></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="closeActionDialog">取消</button>
          <button
            class="btn"
            :class="actionDialog.action === 'revoke' ? 'btn-danger' : 'btn-primary'"
            :disabled="actionDialog.submitting"
            @click="confirmAction"
          >
            {{
              actionDialog.submitting
                ? '处理中…'
                : actionDialog.action === 'revoke'
                  ? '确认撤回'
                  : '确认恢复'
            }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="toast"
      class="toast"
      :class="toastType === 'success' ? 'toast-success' : 'toast-error'"
    >
      {{ toast }}
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filter-range {
  flex-direction: row;
  align-items: center;
}

.filter-sep {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.filter-hint {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-card {
  padding: 0;
  overflow: hidden;
}

.history-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
}

.history-row:hover {
  background: var(--color-bg);
}

.history-date {
  display: flex;
  flex-direction: column;
  min-width: 64px;
}

.history-weekday {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.history-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  flex: 1;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.history-arrow {
  font-size: 13px;
  color: var(--color-primary);
  white-space: nowrap;
}

.history-detail {
  border-top: 1px solid var(--color-border);
  padding: 16px;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.detail-block h4 {
  font-size: 14px;
  margin-bottom: 8px;
  color: var(--color-text-secondary);
}

.detail-block dl {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;
  font-size: 13px;
}

.detail-block dt {
  color: var(--color-text-secondary);
}

.detail-block dd {
  margin: 0;
}

.detail-line {
  font-size: 13px;
  margin-bottom: 4px;
}

.status-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid var(--color-border);
}

.chip-ok {
  background: var(--color-success-soft);
  color: var(--color-success);
  border-color: transparent;
}

.chip-warn {
  background: var(--color-warning-soft);
  color: var(--color-warning);
  border-color: transparent;
}

.detail-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.edit-panel {
  margin-top: 14px;
  padding: 16px;
}

@media (min-width: 768px) {
  .filter-field {
    flex-direction: row;
    align-items: center;
  }

  .detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
