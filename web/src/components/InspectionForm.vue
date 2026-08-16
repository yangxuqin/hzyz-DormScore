<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type {
  BedItem,
  Config,
  EnrichedRecord,
  Period,
  PublicItem,
  SaveInspectionBody,
  UserStatus,
  UserStatusEntry,
} from '../api/types';
import { todayInShanghai, weekdayOf } from '../utils/date';
import {
  BED_ITEM_LABELS,
  PERIOD_LABELS,
  PERIODS,
  PUBLIC_ITEM_LABELS,
  PUBLIC_ITEMS,
  computeDeductions,
} from '../utils/deduction';

const props = withDefaults(
  defineProps<{
    config: Config;
    record: EnrichedRecord | null;
    submitLabel?: string;
    saving?: boolean;
  }>(),
  { submitLabel: '', saving: false },
);

const emit = defineEmits<{
  (e: 'submit', body: SaveInspectionBody): void;
  (e: 'date-change', date: string): void;
}>();

const date = ref(todayInShanghai());
const dutyUserId = ref<number | null>(null);
const statuses = ref<UserStatusEntry[]>([]);
const talkAm = ref(0);
const talkPm = ref(0);
const bedChecks = ref<Record<string, boolean>>({});
const publicChecks = ref<Record<string, boolean>>({});
const reason = ref('');
const hint = ref('');
const formError = ref('');

function bedKey(period: Period, bedId: number, item: BedItem): string {
  return `${period}:${bedId}:${item}`;
}

function publicKey(period: Period, item: PublicItem): string {
  return `${period}:${item}`;
}

function toggleBed(period: Period, bedId: number, item: BedItem): void {
  const key = bedKey(period, bedId, item);
  bedChecks.value[key] = !bedChecks.value[key];
}

function togglePublic(period: Period, item: PublicItem): void {
  const key = publicKey(period, item);
  publicChecks.value[key] = !publicChecks.value[key];
}

function statusOf(userId: number): UserStatus {
  return statuses.value.find((s) => s.userId === userId)?.status ?? 'NORMAL';
}

function nameOf(userId: number): string {
  return props.config.users.find((u) => u.id === userId)?.name ?? '';
}

function bedChecked(period: Period, bedId: number): boolean {
  return !!(
    bedChecks.value[bedKey(period, bedId, 'BED')] || bedChecks.value[bedKey(period, bedId, 'FLOOR')]
  );
}

function toggleStatus(userId: number, status: UserStatus): void {
  const entry = statuses.value.find((s) => s.userId === userId);
  if (!entry) return;
  if (entry.status === status) return;
  entry.status = status;
  // 值日生被标记为请假：自动改选第一个正常成员并提示
  if (status === 'LEAVE' && dutyUserId.value === userId) {
    const firstNormal = props.config.users.find((u) => statusOf(u.id) === 'NORMAL');
    if (firstNormal) {
      dutyUserId.value = firstNormal.id;
      hint.value = `原值日生「${nameOf(userId)}」已请假，已自动切换为「${firstNormal.name}」`;
    } else {
      dutyUserId.value = null;
      hint.value = '原值日生已请假，请先将至少一名成员设为正常状态';
    }
  }
}

function onDutyChange(e: Event): void {
  const value = (e.target as HTMLSelectElement).value;
  dutyUserId.value = value === '' ? null : Number(value);
}

function onTalkInput(e: Event, period: 'AM' | 'PM'): void {
  const raw = Number((e.target as HTMLInputElement).value);
  const value = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
  if (period === 'AM') talkAm.value = value;
  else talkPm.value = value;
}

function onDateChange(e: Event): void {
  const value = (e.target as HTMLInputElement).value;
  if (!value || value === date.value) return;
  date.value = value;
  formError.value = '';
  emit('date-change', value);
}

function resetFields(): void {
  dutyUserId.value = null;
  statuses.value = props.config.users.map((u) => ({
    userId: u.id,
    userName: u.name,
    status: 'NORMAL',
  }));
  talkAm.value = 0;
  talkPm.value = 0;
  bedChecks.value = {};
  publicChecks.value = {};
  reason.value = '';
  hint.value = '';
  formError.value = '';
}

function applyRecord(record: EnrichedRecord): void {
  date.value = record.date;
  dutyUserId.value = record.dutyUserId;
  statuses.value = record.userStatus.map((s) => ({ ...s }));
  talkAm.value = record.talkAm;
  talkPm.value = record.talkPm;
  bedChecks.value = {};
  for (const check of record.bedChecks) {
    bedChecks.value[bedKey(check.period, check.bedId, check.item)] = true;
  }
  publicChecks.value = {};
  for (const check of record.publicChecks) {
    publicChecks.value[publicKey(check.period, check.item)] = true;
  }
  reason.value = '';
  hint.value = '';
  formError.value = '';
}

// config 就绪后初始化默认状态
watch(
  () => props.config,
  (config) => {
    if (config && statuses.value.length === 0) {
      statuses.value = config.users.map((u) => ({
        userId: u.id,
        userName: u.name,
        status: 'NORMAL',
      }));
    }
  },
  { immediate: true },
);

// record 变化 → 预填（更新模式）或清空（新日期）
watch(
  () => props.record,
  (record) => {
    if (record) applyRecord(record);
    else resetFields();
  },
  { immediate: true },
);

const weekday = computed(() => {
  if (props.record && props.record.date === date.value) return props.record.weekday;
  return weekdayOf(date.value);
});

const isUpdateMode = computed(() => !!props.record && props.record.date === date.value);

const normalUsers = computed(() => props.config.users.filter((u) => statusOf(u.id) === 'NORMAL'));

const stats = computed(() => {
  const bedCount = Object.values(bedChecks.value).filter(Boolean).length;
  const publicCount = Object.values(publicChecks.value).filter(Boolean).length;
  const talkCount = talkAm.value + talkPm.value;
  return computeDeductions(bedCount, publicCount, talkCount);
});

function checkedBedChecks(): SaveInspectionBody['bedChecks'] {
  return Object.entries(bedChecks.value)
    .filter(([, checked]) => checked)
    .map(([key]) => {
      const [period, bedId, item] = key.split(':');
      return { period: period as Period, bedId: Number(bedId), item: item as BedItem };
    });
}

function checkedPublicChecks(): SaveInspectionBody['publicChecks'] {
  return Object.entries(publicChecks.value)
    .filter(([, checked]) => checked)
    .map(([key]) => {
      const [period, item] = key.split(':');
      return { period: period as Period, item: item as PublicItem };
    });
}

function submit(): void {
  formError.value = '';
  const today = todayInShanghai();
  if (!date.value) {
    formError.value = '请选择日期';
    return;
  }
  if (date.value > today) {
    formError.value = '不能录入未来日期';
    return;
  }
  if (dutyUserId.value === null) {
    formError.value = '请选择值日生';
    return;
  }
  if (statuses.value.length !== props.config.users.length) {
    formError.value = '成员状态数据不完整，请刷新后重试';
    return;
  }
  const body: SaveInspectionBody = {
    ...(props.record?.id != null ? { id: props.record.id } : {}),
    date: date.value,
    dutyUserId: dutyUserId.value,
    talkAm: talkAm.value,
    talkPm: talkPm.value,
    userStatus: statuses.value.map((s) => ({ userId: s.userId, status: s.status })),
    bedChecks: checkedBedChecks(),
    publicChecks: checkedPublicChecks(),
    ...(reason.value.trim() ? { reason: reason.value.trim() } : {}),
  };
  emit('submit', body);
}
</script>

<template>
  <div class="inspection-form">
    <!-- 更新模式提示 -->
    <div v-if="isUpdateMode" class="banner banner-info">
      <strong>更新模式：</strong>该日已有记录，将更新原记录。
      <span v-if="record?.status === 'REVOKED'">该日记录已撤回，重新提交将恢复。</span>
      <span v-else>当前状态：有效。</span>
    </div>

    <div v-if="hint" class="banner banner-warning">{{ hint }}</div>
    <div v-if="formError" class="banner banner-error">{{ formError }}</div>

    <!-- 基本信息 -->
    <section class="form-section">
      <h3 class="section-title">基本信息</h3>
      <div class="form-grid">
        <div class="form-field">
          <label class="form-label" for="inspection-date">日期</label>
          <input
            id="inspection-date"
            type="date"
            class="input"
            :max="todayInShanghai()"
            :value="date"
            @change="onDateChange"
          />
        </div>
        <div class="form-field">
          <span class="form-label">星期</span>
          <div class="weekday-display">{{ weekday }}</div>
        </div>
      </div>
      <div class="form-field">
        <label class="form-label" for="duty-user">值日生</label>
        <select id="duty-user" class="select" :value="dutyUserId ?? ''" @change="onDutyChange">
          <option value="" disabled>请选择值日生</option>
          <option v-for="u in normalUsers" :key="u.id" :value="u.id">{{ u.name }}</option>
        </select>
        <div class="form-hint">仅当天状态为「正常」的成员可担任值日生</div>
      </div>

      <div class="form-field">
        <span class="form-label">成员状态</span>
        <div class="user-status-list">
          <div v-for="u in config.users" :key="u.id" class="user-status-row">
            <span class="user-name">{{ u.name }}</span>
            <div class="segmented segmented-block">
              <button
                type="button"
                :class="{ active: statusOf(u.id) === 'NORMAL' }"
                @click="toggleStatus(u.id, 'NORMAL')"
              >
                正常
              </button>
              <button
                type="button"
                :class="{ active: statusOf(u.id) === 'LEAVE' }"
                @click="toggleStatus(u.id, 'LEAVE')"
              >
                请假
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 上下午检查 -->
    <section v-for="period in PERIODS" :key="period" class="form-section">
      <h3 class="section-title">{{ PERIOD_LABELS[period] }}检查</h3>
      <div class="form-field">
        <span class="form-label">床位检查（每项 2 分）</span>
        <div class="check-grid">
          <div
            v-for="bed in config.beds"
            :key="bed.id"
            class="bed-group"
            :class="{ checked: bedChecked(period, bed.id) }"
          >
            <div class="bed-group-title">{{ bed.name }}</div>
            <div class="bed-items">
              <label
                class="check-item"
                :class="{ checked: !!bedChecks[bedKey(period, bed.id, 'BED')] }"
              >
                <input
                  type="checkbox"
                  :checked="!!bedChecks[bedKey(period, bed.id, 'BED')]"
                  @change="toggleBed(period, bed.id, 'BED')"
                />
                <span>{{ BED_ITEM_LABELS.BED }}</span>
              </label>
              <label
                class="check-item"
                :class="{ checked: !!bedChecks[bedKey(period, bed.id, 'FLOOR')] }"
              >
                <input
                  type="checkbox"
                  :checked="!!bedChecks[bedKey(period, bed.id, 'FLOOR')]"
                  @change="toggleBed(period, bed.id, 'FLOOR')"
                />
                <span>{{ BED_ITEM_LABELS.FLOOR }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>
      <div class="form-field">
        <span class="form-label">公共区域（每项 1 分）</span>
        <div class="check-grid">
          <label
            v-for="item in PUBLIC_ITEMS"
            :key="item"
            class="check-item"
            :class="{ checked: !!publicChecks[publicKey(period, item)] }"
          >
            <input
              type="checkbox"
              :checked="!!publicChecks[publicKey(period, item)]"
              @change="togglePublic(period, item)"
            />
            <span>{{ PUBLIC_ITEM_LABELS[item] }}</span>
          </label>
        </div>
      </div>
      <div class="form-field">
        <label class="form-label" :for="`talk-${period}`">讲话次数（每次 2 分）</label>
        <input
          :id="`talk-${period}`"
          type="number"
          class="input talk-input"
          min="0"
          step="1"
          inputmode="numeric"
          :value="period === 'AM' ? talkAm : talkPm"
          @input="onTalkInput($event, period)"
        />
      </div>
    </section>

    <!-- 实时统计 -->
    <section class="form-section stats-section">
      <h3 class="section-title">实时统计</h3>
      <div class="stats-list">
        <div class="stat-row">
          <span>床位扣分</span>
          <strong>{{ stats.bedDeduction }} 分</strong>
        </div>
        <div class="stat-row">
          <span>公共区域扣分</span>
          <strong>{{ stats.publicDeduction }} 分</strong>
        </div>
        <div class="stat-row">
          <span>纪律扣分（讲话 {{ stats.talkCount }} 次）</span>
          <strong>{{ stats.disciplineDeduction }} 分</strong>
        </div>
        <div class="stat-row">
          <span>总扣分</span>
          <strong>{{ stats.totalDeduction }} 分</strong>
        </div>
        <div class="stat-row stat-row-total">
          <span>今日得分</span>
          <strong>{{ stats.score }} / 20</strong>
        </div>
      </div>
    </section>

    <!-- 修改原因 -->
    <div class="form-field">
      <label class="form-label" for="edit-reason">修改原因（可选）</label>
      <textarea
        id="edit-reason"
        v-model="reason"
        class="textarea"
        placeholder="修改数据时建议填写原因，便于追溯"
        rows="2"
      ></textarea>
    </div>

    <button
      type="button"
      class="btn btn-primary btn-lg btn-block"
      :disabled="saving"
      @click="submit"
    >
      {{ saving ? '保存中…' : submitLabel || (isUpdateMode ? '更新记录' : '提交记录') }}
    </button>
  </div>
</template>

<style scoped>
.form-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-primary);
  padding-bottom: 6px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 12px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0 14px;
}

.weekday-display {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-text-secondary);
}

.user-status-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.user-name {
  font-weight: 500;
  min-width: 64px;
}

.check-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.bed-group {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 8px;
  background: var(--color-card);
}

.bed-group.checked {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.bed-group-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}

.bed-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-card);
  cursor: pointer;
  user-select: none;
  font-size: 14px;
}

.check-item.checked {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.check-item input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
  flex-shrink: 0;
}

.talk-input {
  max-width: 160px;
}

.stats-section {
  background: var(--color-bg);
  border-radius: var(--radius);
  padding: 12px;
}

.stats-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--color-card);
  border-radius: var(--radius-sm);
  font-size: 14px;
}

.stat-row-total {
  background: var(--color-primary-soft);
  font-weight: 600;
  color: var(--color-primary);
}

@media (min-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr 1fr;
  }

  .check-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
