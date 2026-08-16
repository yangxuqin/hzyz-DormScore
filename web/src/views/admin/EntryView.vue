<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ApiError, apiGet, apiPost, errorMessage } from '../../api/client';
import type { Config, EnrichedRecord, SaveInspectionBody } from '../../api/types';
import { todayInShanghai } from '../../utils/date';
import InspectionForm from '../../components/InspectionForm.vue';
import StateBox from '../../components/StateBox.vue';

const config = ref<Config | null>(null);
const configLoading = ref(true);
const configError = ref('');

const currentDate = ref(todayInShanghai());
const record = ref<EnrichedRecord | null>(null);
const loadingByDate = ref(false);
const byDateError = ref('');
const saving = ref(false);
const toast = ref('');
const toastType = ref<'success' | 'error'>('success');

let loadSeq = 0;

function showToast(message: string, type: 'success' | 'error' = 'success'): void {
  toast.value = message;
  toastType.value = type;
  window.setTimeout(() => {
    if (toast.value === message) toast.value = '';
  }, 3000);
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

async function loadByDate(d: string): Promise<void> {
  const seq = ++loadSeq;
  loadingByDate.value = true;
  byDateError.value = '';
  try {
    const data = await apiGet<{ record: EnrichedRecord | null }>('/admin/inspections/by-date', {
      date: d,
    });
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

function onDateChange(d: string): void {
  currentDate.value = d;
  void loadByDate(d);
}

async function onSubmit(body: SaveInspectionBody): Promise<void> {
  saving.value = true;
  try {
    const data = await apiPost<{
      record: EnrichedRecord;
      action: 'created' | 'updated' | 'unchanged';
    }>('/admin/inspections', body);
    const text =
      data.action === 'created'
        ? '新增成功'
        : data.action === 'updated'
          ? '更新成功'
          : '数据未发生变化，已是最新';
    record.value = data.record;
    currentDate.value = data.record.date;
    showToast(text, 'success');
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
    <h2 class="page-title">每日录入</h2>

    <StateBox v-if="configLoading" loading />
    <StateBox v-else-if="configError" :error="configError" @retry="loadConfig" />

    <template v-else-if="config">
      <div v-if="loadingByDate" class="banner banner-info">正在加载该日记录…</div>
      <div v-if="byDateError" class="banner banner-error">
        {{ byDateError }}
        <button class="btn btn-sm btn-outline" @click="loadByDate(currentDate)">重试</button>
      </div>

      <div class="card">
        <InspectionForm
          :config="config"
          :record="record"
          :saving="saving"
          @date-change="onDateChange"
          @submit="onSubmit"
        />
      </div>
    </template>

    <div
      v-if="toast"
      class="toast"
      :class="toastType === 'success' ? 'toast-success' : 'toast-error'"
    >
      {{ toast }}
    </div>
  </div>
</template>
