<!-- 管理 · 每日录入 -->
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { AppConfig, EnrichedRecord, SaveInspectionBody } from '@dorm/contracts';
import { ApiError, errorMessage } from '../../api/client';
import { adminApi, configApi } from '../../api/endpoints';
import { showToast } from '../../composables/useToast';
import { todayInShanghai } from '../../utils/date';
import MCard from '../../components/ui/MCard.vue';
import MStateBox from '../../components/ui/MStateBox.vue';
import InspectionForm from '../../features/inspection/InspectionForm.vue';

const config = ref<AppConfig | null>(null);
const configLoading = ref(true);
const configError = ref('');

const currentDate = ref(todayInShanghai());
const record = ref<EnrichedRecord | null>(null);
const loadingByDate = ref(false);
const byDateError = ref('');
const saving = ref(false);

let loadSeq = 0;

async function loadConfig(): Promise<void> {
  configLoading.value = true;
  configError.value = '';
  try {
    config.value = await configApi.get();
  } catch (e) {
    configError.value = errorMessage(e, '配置加载失败');
  } finally {
    configLoading.value = false;
  }
}

async function loadByDate(date: string): Promise<void> {
  const seq = ++loadSeq;
  loadingByDate.value = true;
  byDateError.value = '';
  try {
    const data = await adminApi.inspectionByDate(date);
    if (seq !== loadSeq) return;
    record.value = data.record;
  } catch (e) {
    if (seq !== loadSeq) return;
    byDateError.value = errorMessage(e, '该日记录加载失败');
    record.value = null;
  } finally {
    if (seq === loadSeq) loadingByDate.value = false;
  }
}

function onDateChange(date: string): void {
  currentDate.value = date;
  void loadByDate(date);
}

async function onSubmit(body: SaveInspectionBody): Promise<void> {
  saving.value = true;
  try {
    const data = await adminApi.saveInspection(body);
    record.value = data.record;
    currentDate.value = data.record.date;
    showToast(
      data.action === 'created'
        ? '新增成功'
        : data.action === 'updated'
          ? '更新成功'
          : '数据未发生变化',
      data.action === 'unchanged' ? 'info' : 'success',
    );
  } catch (e) {
    if (e instanceof ApiError && e.code === 'DATE_CONFLICT') {
      showToast(`提交失败：${e.message}`, 'error');
    } else {
      showToast(`提交失败：${errorMessage(e)}`, 'error');
    }
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void loadConfig();
  void loadByDate(todayInShanghai());
});
</script>

<template>
  <div class="page page-stack">
    <div class="page-header">
      <h2 class="page-title">每日录入</h2>
      <span class="text-muted type-body-small">床面 / 床下按「时段 × 区域」各扣 2 分</span>
    </div>

    <MStateBox :loading="configLoading" :error="configError" @retry="loadConfig">
      <template v-if="config">
        <div v-if="loadingByDate" class="m-banner m-banner--info">正在加载该日记录…</div>
        <div v-else-if="byDateError" class="m-banner m-banner--error">
          {{ byDateError }}
          <button class="link-btn" @click="loadByDate(currentDate)">重试</button>
        </div>

        <MCard variant="elevated">
          <InspectionForm
            :config="config"
            :record="record"
            :saving="saving"
            @date-change="onDateChange"
            @submit="onSubmit"
          />
        </MCard>
      </template>
    </MStateBox>
  </div>
</template>

<style scoped>
.link-btn {
  border: none;
  background: transparent;
  color: inherit;
  text-decoration: underline;
  padding: 0 4px;
}
</style>
