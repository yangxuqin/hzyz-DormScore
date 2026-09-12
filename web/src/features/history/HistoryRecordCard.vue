<!-- 历史记录条目：折叠详情 + 上下午扣分池 + 修改/撤回/恢复 -->
<script setup lang="ts">
import { ref } from 'vue';
import type { AppConfig, EnrichedRecord, SaveInspectionBody } from '@dorm/contracts';
import MButton from '../../components/ui/MButton.vue';
import MIcon from '../../components/ui/MIcon.vue';
import {
  BED_ITEM_LABELS,
  PERIODS,
  PERIOD_LABELS,
  PUBLIC_ITEM_LABELS,
} from '../../domain/constants';
import { formatDateCn, formatDateTime } from '../../utils/date';
import PeriodPools from '../calendar/PeriodPools.vue';
import InspectionForm from '../inspection/InspectionForm.vue';

const props = defineProps<{
  record: EnrichedRecord;
  config: AppConfig | null;
  saving: boolean;
}>();

const emit = defineEmits<{
  (e: 'save', body: SaveInspectionBody): void;
  (e: 'toggle-status', record: EnrichedRecord): void;
}>();

const expanded = ref(false);
const editing = ref(false);

function toggleDetail(): void {
  expanded.value = !expanded.value;
  editing.value = false;
}

function onSave(body: SaveInspectionBody): void {
  emit('save', body);
}
</script>

<template>
  <article class="m-card history-card">
    <button class="history-row" type="button" :aria-expanded="expanded" @click="toggleDetail">
      <div class="history-date">
        <b class="type-title-small">{{ formatDateCn(record.date) }}</b>
        <span class="text-muted type-body-small">{{ record.weekday }}</span>
      </div>
      <div class="history-meta type-body-small">
        <span>值日生 {{ record.dutyUserName }}</span>
        <span class="numeric">扣分 {{ record.totalDeduction }}</span>
        <span class="numeric">得分 {{ record.score }}</span>
        <span class="m-badge" :class="record.status === 'ACTIVE' ? 'm-badge--success' : ''">
          {{ record.status === 'ACTIVE' ? '有效' : '已撤回' }}
        </span>
      </div>
      <MIcon class="history-arrow" :name="expanded ? 'minus' : 'chevron-down'" :size="18" />
    </button>

    <div v-if="expanded" class="history-detail">
      <div class="detail-grid">
        <div class="detail-block">
          <div class="section-label">基本信息</div>
          <dl class="detail-dl">
            <dt>日期</dt>
            <dd>{{ record.date }}（{{ record.weekday }}）</dd>
            <dt>值日生</dt>
            <dd>{{ record.dutyUserName }}</dd>
            <dt>创建</dt>
            <dd>{{ formatDateTime(record.createdAt) }}</dd>
            <dt>更新</dt>
            <dd>{{ formatDateTime(record.updatedAt) }}</dd>
          </dl>
        </div>
        <div class="detail-block">
          <div class="section-label">成员状态</div>
          <div class="status-chips">
            <span
              v-for="s in record.userStatus"
              :key="s.userId"
              class="m-badge"
              :class="s.status === 'NORMAL' ? 'm-badge--success' : 'm-badge--warning'"
            >
              {{ s.userName }} {{ s.status === 'NORMAL' ? '正常' : '请假' }}
            </span>
          </div>
        </div>
      </div>

      <div class="detail-pools">
        <div v-for="period in PERIODS" :key="period" class="detail-block">
          <div class="section-label">{{ PERIOD_LABELS[period] }}</div>
          <PeriodPools :record="record" :period="period" />
        </div>
      </div>

      <div class="detail-composition">
        <span class="m-badge">床位 {{ record.bedDeduction }}</span>
        <span class="m-badge">公共 {{ record.publicDeduction }}</span>
        <span class="m-badge">纪律 {{ record.disciplineDeduction }}</span>
        <span class="m-badge">总扣 {{ record.totalDeduction }}</span>
        <span class="m-badge m-badge--primary">得分 {{ record.score }} / 20</span>
      </div>

      <div class="detail-actions">
        <MButton size="sm" :variant="editing ? 'tonal' : 'filled'" @click="editing = !editing">
          <template #icon><MIcon name="settings" :size="16" /></template>
          {{ editing ? '收起修改' : '修改' }}
        </MButton>
        <MButton
          v-if="record.status === 'ACTIVE'"
          size="sm"
          variant="danger-outlined"
          @click="emit('toggle-status', record)"
        >
          撤回
        </MButton>
        <MButton v-else size="sm" variant="outlined" @click="emit('toggle-status', record)">
          恢复
        </MButton>
      </div>

      <div v-if="editing && config" class="edit-panel">
        <InspectionForm
          :key="record.id"
          :config="config"
          :record="record"
          :saving="saving"
          submit-label="保存修改"
          @submit="onSave"
        />
      </div>
    </div>
  </article>
</template>

<style scoped>
.history-card {
  padding: 0;
  overflow: hidden;
}
.history-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  width: 100%;
  padding: var(--space-4);
  border: none;
  background: transparent;
  text-align: left;
  transition: background var(--motion-fast) var(--ease-standard);
}
.history-row:hover {
  background: var(--md-surface-container);
}
.history-date {
  display: flex;
  flex-direction: column;
  min-width: 72px;
}
.history-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  flex: 1;
  color: var(--md-on-surface-variant);
}
.history-arrow {
  color: var(--md-primary);
  flex-shrink: 0;
}
.history-detail {
  border-top: 1px solid var(--md-outline-variant);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  animation: fade-up var(--motion-medium) var(--ease-decelerate);
}
.detail-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-5);
}
.detail-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.detail-dl {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px var(--space-3);
  font-size: var(--text-body-small);
}
.detail-dl dt {
  color: var(--md-on-surface-variant);
}
.detail-dl dd {
  margin: 0;
}
.status-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.detail-pools {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-5);
  padding: var(--space-4);
  background: var(--md-surface-container);
  border-radius: var(--shape-lg);
}
.detail-composition {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.detail-actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.edit-panel {
  padding: var(--space-5);
  background: var(--md-surface-container);
  border-radius: var(--shape-lg);
}
@media (min-width: 768px) {
  .detail-grid {
    grid-template-columns: 1fr 1fr;
  }
  .detail-pools {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
