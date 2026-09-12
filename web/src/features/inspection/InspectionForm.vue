<!-- 每日录入表单：以「时段 × 区域」扣分池为核心，实时显示责任分摊 -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type {
  AppConfig,
  BedItem,
  EnrichedRecord,
  Period,
  PublicItem,
  SaveInspectionBody,
  UserStatus,
} from '@dorm/contracts';
import MButton from '../../components/ui/MButton.vue';
import MIcon from '../../components/ui/MIcon.vue';
import {
  BED_ITEMS,
  BED_ITEM_LABELS,
  PERIODS,
  PERIOD_LABELS,
  PUBLIC_ITEMS,
  PUBLIC_ITEM_LABELS,
} from '../../domain/constants';
import { computeLocalSummary, formatShare, type LocalPool } from '../../domain/pools';
import { todayInShanghai, weekdayOf } from '../../utils/date';
import PeriodPoolPicker from './PeriodPoolPicker.vue';

const props = withDefaults(
  defineProps<{
    config: AppConfig;
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
const statuses = ref<Map<number, UserStatus>>(new Map());
const talk = ref<Record<Period, number>>({ AM: 0, PM: 0 });
/** 扣分池选择：period → item → 命中床位 id 列表 */
const selected = ref<Record<Period, Record<BedItem, number[]>>>({
  AM: { BED: [], FLOOR: [] },
  PM: { BED: [], FLOOR: [] },
});
/** 公共区域选择：period:item → bool */
const publicChecked = ref<Record<string, boolean>>({});
const reason = ref('');
const hint = ref('');
const formError = ref('');

function initStatuses(config: AppConfig): void {
  statuses.value = new Map(config.users.map((u) => [u.id, 'NORMAL']));
}

function emptySelection(): Record<Period, Record<BedItem, number[]>> {
  return { AM: { BED: [], FLOOR: [] }, PM: { BED: [], FLOOR: [] } };
}

function resetFields(): void {
  dutyUserId.value = null;
  initStatuses(props.config);
  talk.value = { AM: 0, PM: 0 };
  selected.value = emptySelection();
  publicChecked.value = {};
  reason.value = '';
  hint.value = '';
  formError.value = '';
}

function applyRecord(record: EnrichedRecord): void {
  date.value = record.date;
  dutyUserId.value = record.dutyUserId;
  statuses.value = new Map(record.userStatus.map((s) => [s.userId, s.status]));
  talk.value = { AM: record.talkAm, PM: record.talkPm };
  selected.value = emptySelection();
  for (const pool of record.bedChecks) selected.value[pool.period][pool.item] = [...pool.beds];
  publicChecked.value = {};
  for (const c of record.publicChecks) publicChecked.value[`${c.period}:${c.item}`] = true;
  reason.value = '';
  hint.value = '';
  formError.value = '';
}

watch(
  () => props.config,
  (config) => {
    if (config && statuses.value.size === 0) initStatuses(config);
  },
  { immediate: true },
);

watch(
  () => props.record,
  (record) => {
    if (record) applyRecord(record);
    else resetFields();
  },
  { immediate: true },
);

const weekday = computed(() =>
  props.record && props.record.date === date.value ? props.record.weekday : weekdayOf(date.value),
);
const isUpdateMode = computed(() => !!props.record && props.record.date === date.value);
const normalUsers = computed(() =>
  props.config.users.filter((u) => statuses.value.get(u.id) === 'NORMAL'),
);

function toggleBed(period: Period, item: BedItem, bedId: number): void {
  const list = selected.value[period][item];
  const idx = list.indexOf(bedId);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(bedId);
  formError.value = '';
}

function togglePublic(period: Period, item: PublicItem): void {
  const key = `${period}:${item}`;
  publicChecked.value[key] = !publicChecked.value[key];
}

function setStatus(userId: number, status: UserStatus): void {
  if (statuses.value.get(userId) === status) return;
  statuses.value.set(userId, status);
  if (status === 'LEAVE' && dutyUserId.value === userId) {
    const firstNormal = props.config.users.find((u) => statuses.value.get(u.id) === 'NORMAL');
    dutyUserId.value = firstNormal ? firstNormal.id : null;
    const name = props.config.users.find((u) => u.id === userId)?.name ?? '';
    hint.value = firstNormal
      ? `原值日生「${name}」已请假，已自动切换为「${firstNormal.name}」`
      : '原值日生已请假，请先将至少一名成员设为正常状态';
  }
}

function onDutyChange(e: Event): void {
  const value = (e.target as HTMLSelectElement).value;
  dutyUserId.value = value === '' ? null : Number(value);
}

function onTalkInput(e: Event, period: Period): void {
  const raw = Number((e.target as HTMLInputElement).value);
  talk.value[period] = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}

function onDateChange(e: Event): void {
  const value = (e.target as HTMLInputElement).value;
  if (!value || value === date.value) return;
  date.value = value;
  formError.value = '';
  emit('date-change', value);
}

function poolsFor(period: Period): LocalPool[] {
  const result: LocalPool[] = [];
  for (const item of BED_ITEMS) {
    const beds = selected.value[period][item];
    if (beds.length > 0) result.push({ period, item, beds: [...beds] });
  }
  return result;
}

const summary = computed(() =>
  computeLocalSummary(
    [...poolsFor('AM'), ...poolsFor('PM')],
    selectedPublicChecks(),
    talk.value.AM + talk.value.PM,
    props.config,
    statuses.value,
  ),
);

function selectedPublicChecks(): { period: Period; item: PublicItem }[] {
  const result: { period: Period; item: PublicItem }[] = [];
  for (const period of PERIODS) {
    for (const item of PUBLIC_ITEMS) {
      if (publicChecked.value[`${period}:${item}`]) result.push({ period, item });
    }
  }
  return result;
}

function submit(): void {
  formError.value = '';
  if (!date.value) {
    formError.value = '请选择日期';
    return;
  }
  if (date.value > todayInShanghai()) {
    formError.value = '不能录入未来日期';
    return;
  }
  if (dutyUserId.value === null) {
    formError.value = '请选择值日生';
    return;
  }
  const body: SaveInspectionBody = {
    ...(props.record?.id != null ? { id: props.record.id } : {}),
    date: date.value,
    dutyUserId: dutyUserId.value,
    talkAm: talk.value.AM,
    talkPm: talk.value.PM,
    userStatus: props.config.users.map((u) => ({
      userId: u.id,
      status: statuses.value.get(u.id) ?? 'NORMAL',
    })),
    bedChecks: [...poolsFor('AM'), ...poolsFor('PM')],
    publicChecks: selectedPublicChecks(),
    ...(reason.value.trim() ? { reason: reason.value.trim() } : {}),
  };
  emit('submit', body);
}
</script>

<template>
  <div class="inspection-form">
    <div v-if="isUpdateMode" class="m-banner m-banner--info">
      <MIcon name="info" :size="18" />
      <span>
        <b>更新模式：</b>该日已有记录，将更新原记录。
        <template v-if="record?.status === 'REVOKED'">该日记录已撤回，重新提交将恢复。</template>
      </span>
    </div>
    <div v-if="hint" class="m-banner m-banner--warning">{{ hint }}</div>
    <div v-if="formError" class="m-banner m-banner--error">{{ formError }}</div>

    <!-- 基本信息 -->
    <section class="form-section">
      <h3 class="section-heading">基本信息</h3>
      <div class="form-row">
        <div class="m-field">
          <label class="m-field-label" for="inspection-date">日期</label>
          <input
            id="inspection-date"
            type="date"
            class="m-input"
            :max="todayInShanghai()"
            :value="date"
            @change="onDateChange"
          />
        </div>
        <div class="m-field">
          <span class="m-field-label">星期</span>
          <div class="weekday-display">{{ weekday }}</div>
        </div>
      </div>

      <div class="m-field">
        <label class="m-field-label" for="duty-user">值日生</label>
        <select id="duty-user" class="m-select" :value="dutyUserId ?? ''" @change="onDutyChange">
          <option value="" disabled>请选择值日生</option>
          <option v-for="u in normalUsers" :key="u.id" :value="u.id">{{ u.name }}</option>
        </select>
        <span class="m-hint">仅当天状态为「正常」的成员可担任值日生</span>
      </div>

      <div class="m-field">
        <span class="m-field-label">成员状态</span>
        <div class="user-status-list">
          <div v-for="u in config.users" :key="u.id" class="user-status-row">
            <span class="user-name type-body-medium">{{ u.name }}</span>
            <div class="m-segmented">
              <button
                type="button"
                :class="{ active: statuses.get(u.id) === 'NORMAL' }"
                @click="setStatus(u.id, 'NORMAL')"
              >
                正常
              </button>
              <button
                type="button"
                :class="{ active: statuses.get(u.id) === 'LEAVE' }"
                @click="setStatus(u.id, 'LEAVE')"
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
      <h3 class="section-heading">{{ PERIOD_LABELS[period] }}检查</h3>

      <div class="pool-grid">
        <PeriodPoolPicker
          v-for="item in BED_ITEMS"
          :key="item"
          :config="config"
          :period="period"
          :item="item"
          :selected="selected[period][item]"
          :user-status="statuses"
          @toggle="(bedId) => toggleBed(period, item, bedId)"
        />
      </div>

      <div class="m-field">
        <span class="m-field-label">公共区域（每项 1 分）</span>
        <div class="public-options">
          <button
            v-for="item in PUBLIC_ITEMS"
            :key="item"
            type="button"
            class="m-chip"
            :class="{ 'm-chip--selected': publicChecked[`${period}:${item}`] }"
            :aria-pressed="!!publicChecked[`${period}:${item}`]"
            @click="togglePublic(period, item)"
          >
            {{ PUBLIC_ITEM_LABELS[item] }}
          </button>
        </div>
      </div>

      <div class="m-field talk-field">
        <label class="m-field-label" :for="`talk-${period}`">讲话次数（每次 2 分）</label>
        <input
          :id="`talk-${period}`"
          type="number"
          class="m-input"
          min="0"
          step="1"
          inputmode="numeric"
          :value="talk[period]"
          @input="onTalkInput($event, period)"
        />
      </div>
    </section>

    <!-- 实时统计 -->
    <section class="summary-card">
      <h3 class="section-heading">实时统计</h3>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="type-body-small text-muted">床位扣分</span>
          <b class="numeric">{{ summary.bedDeduction }}</b>
        </div>
        <div class="summary-item">
          <span class="type-body-small text-muted">公共区域</span>
          <b class="numeric">{{ summary.publicDeduction }}</b>
        </div>
        <div class="summary-item">
          <span class="type-body-small text-muted">纪律（{{ summary.talkCount }} 次）</span>
          <b class="numeric">{{ summary.disciplineDeduction }}</b>
        </div>
        <div class="summary-item">
          <span class="type-body-small text-muted">总扣分</span>
          <b class="numeric">{{ summary.totalDeduction }}</b>
        </div>
        <div class="summary-item summary-total">
          <span class="type-body-small">今日得分</span>
          <b class="numeric">{{ summary.score }} / 20</b>
        </div>
      </div>

      <div v-if="summary.responsible.length" class="responsible-list">
        <div
          v-for="r in summary.responsible"
          :key="`${r.pool.period}:${r.pool.item}`"
          class="resp-row"
        >
          <span class="type-body-small text-muted">
            {{ PERIOD_LABELS[r.pool.period] }} · {{ BED_ITEM_LABELS[r.pool.item] }}
          </span>
          <span class="type-body-small">
            <template v-if="r.users.length">
              {{ r.users.map((u) => u.name).join('、') }} · 人均 {{ formatShare(r.perUser) }} 分
            </template>
            <template v-else>命中床位均请假，个人不承担</template>
          </span>
        </div>
      </div>
    </section>

    <div class="m-field">
      <label class="m-field-label" for="edit-reason">修改原因（可选）</label>
      <textarea
        id="edit-reason"
        v-model="reason"
        class="m-textarea"
        placeholder="修改数据时建议填写原因，便于追溯"
        rows="2"
      />
    </div>

    <MButton variant="filled" size="lg" block :disabled="saving" @click="submit">
      <template #icon><MIcon name="check" :size="18" /></template>
      {{ saving ? '保存中…' : submitLabel || (isUpdateMode ? '更新记录' : '提交记录') }}
    </MButton>
  </div>
</template>

<style scoped>
.inspection-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.section-heading {
  font-size: var(--text-title-small);
  font-weight: var(--weight-semibold);
  color: var(--md-primary);
  padding-bottom: 6px;
  border-bottom: 1px solid var(--md-outline-variant);
}
.form-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}
.weekday-display {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 0 var(--space-4);
  border: 1px solid var(--md-outline-variant);
  border-radius: var(--shape-md);
  background: var(--md-surface-container);
  color: var(--md-on-surface-variant);
}
.user-status-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
.user-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.user-name {
  font-weight: var(--weight-medium);
  min-width: 60px;
}
.pool-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}
.public-options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
.talk-field {
  max-width: 220px;
}
.summary-card {
  background: var(--md-surface-container);
  border-radius: var(--shape-2xl);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
}
.summary-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-3);
  background: var(--md-surface-container-lowest);
  border-radius: var(--shape-md);
}
.summary-item b {
  font-size: var(--text-title-large);
}
.summary-total {
  background: var(--md-primary-container);
  color: var(--md-on-primary-container);
}
.summary-total b {
  color: var(--md-on-primary-container);
}
.responsible-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.resp-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}
@media (min-width: 768px) {
  .form-row {
    grid-template-columns: 1fr 1fr;
  }
  .pool-grid {
    grid-template-columns: 1fr 1fr;
  }
  .summary-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}
</style>
