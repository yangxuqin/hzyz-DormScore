<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { apiGet, apiPut, errorMessage } from '../../api/client';
import type { Config, MemberInput } from '../../api/types';
import StateBox from '../../components/StateBox.vue';

// ---- 成员设置 ----
const config = ref<Config | null>(null);
const loading = ref(true);
const error = ref('');

const usersForm = ref<MemberInput[]>([]);
const membersSaving = ref(false);
const membersError = ref('');
const membersSuccess = ref('');

function bedTypeOf(bedId: number): 'double' | 'single' {
  return config.value?.beds.find((b) => b.id === bedId)?.type ?? 'double';
}

function onUserBedChange(u: MemberInput, e: Event): void {
  const bedId = Number((e.target as HTMLSelectElement).value);
  const bed = config.value?.beds.find((b) => b.id === bedId);
  u.bedId = bedId;
  if (bed?.type === 'single') u.position = 'single';
  else if (u.position === 'single') u.position = 'upper';
}

function onUserPositionChange(u: MemberInput, e: Event): void {
  u.position = (e.target as HTMLSelectElement).value as MemberInput['position'];
}

function validateMembers(): string | null {
  const users = usersForm.value;
  if (users.length !== 7) return '成员数量必须为 7 人';
  for (const u of users) {
    const name = u.name.trim();
    if (name.length < 1 || name.length > 20) return '成员姓名需为 1-20 个字符';
    const bed = config.value?.beds.find((b) => b.id === u.bedId);
    if (!bed) return `成员「${name}」的床位无效`;
    if (bed.type === 'double' && u.position !== 'upper' && u.position !== 'lower') {
      return `成员「${name}」的铺位无效`;
    }
    if (bed.type === 'single' && u.position !== 'single') {
      return `成员「${name}」在单人床只能选择单人铺位`;
    }
  }
  for (const bed of config.value?.beds ?? []) {
    const members = users.filter((u) => u.bedId === bed.id);
    if (bed.type === 'double') {
      const upper = members.filter((u) => u.position === 'upper').length;
      const lower = members.filter((u) => u.position === 'lower').length;
      if (upper !== 1 || lower !== 1) return `「${bed.name}」需恰好一上一下`;
    } else {
      if (members.length !== 1) return `「${bed.name}」需恰好一人`;
    }
  }
  return null;
}

async function saveMembers(): Promise<void> {
  membersError.value = '';
  membersSuccess.value = '';
  const validation = validateMembers();
  if (validation) {
    membersError.value = validation;
    return;
  }
  membersSaving.value = true;
  try {
    const data = await apiPut<Config>('/config/members', {
      users: usersForm.value.map((u) => ({ ...u, name: u.name.trim() })),
    });
    config.value = data;
    usersForm.value = data.users.map((u) => ({
      id: u.id,
      name: u.name,
      bedId: u.bedId,
      position: u.position,
    }));
    membersSuccess.value = '成员设置已保存';
  } catch (e) {
    membersError.value = errorMessage(e, '保存失败');
  } finally {
    membersSaving.value = false;
  }
}

// ---- 密码设置 ----
const pwForm = reactive({ current: '', viewer: '', admin: '' });
const pwSaving = ref(false);
const pwError = ref('');
const pwSuccess = ref('');

async function savePasswords(): Promise<void> {
  pwError.value = '';
  pwSuccess.value = '';
  if (!pwForm.current) {
    pwError.value = '请输入当前管理密码';
    return;
  }
  if (!pwForm.viewer && !pwForm.admin) {
    pwError.value = '展示密码与管理密码请至少填写一个';
    return;
  }
  for (const [label, value] of [
    ['展示密码', pwForm.viewer],
    ['管理密码', pwForm.admin],
  ] as const) {
    if (value && (value.length < 4 || value.length > 64)) {
      pwError.value = `${label}长度需为 4-64 位`;
      return;
    }
  }
  pwSaving.value = true;
  try {
    const body: { currentAdminPassword: string; viewerPassword?: string; adminPassword?: string } =
      { currentAdminPassword: pwForm.current };
    if (pwForm.viewer) body.viewerPassword = pwForm.viewer;
    if (pwForm.admin) body.adminPassword = pwForm.admin;
    await apiPut<null>('/admin/passwords', body);
    pwSuccess.value = '密码修改成功';
    pwForm.current = '';
    pwForm.viewer = '';
    pwForm.admin = '';
  } catch (e) {
    pwError.value = errorMessage(e, '密码修改失败');
  } finally {
    pwSaving.value = false;
  }
}

async function loadConfig(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    config.value = await apiGet<Config>('/config');
    usersForm.value = config.value.users.map((u) => ({
      id: u.id,
      name: u.name,
      bedId: u.bedId,
      position: u.position,
    }));
  } catch (e) {
    error.value = errorMessage(e, '配置加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(() => void loadConfig());
</script>

<template>
  <div class="page page-stack">
    <h2 class="page-title">设置</h2>

    <!-- 成员设置 -->
    <section class="card">
      <div class="card-title">成员设置</div>
      <p class="form-hint member-hint">姓名 1-20 字；上下铺床需恰好一上一下，单人床需恰好一人</p>

      <StateBox v-if="loading" loading />
      <StateBox v-else-if="error" :error="error" @retry="loadConfig" />

      <template v-else-if="config">
        <div class="member-list">
          <div v-for="u in usersForm" :key="u.id" class="member-row">
            <input
              v-model="u.name"
              class="input"
              placeholder="姓名"
              maxlength="20"
              aria-label="成员姓名"
            />
            <select
              class="select"
              :value="u.bedId"
              aria-label="床位"
              @change="onUserBedChange(u, $event)"
            >
              <option v-for="b in config.beds" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
            <select
              class="select"
              :value="u.position"
              aria-label="铺位"
              @change="onUserPositionChange(u, $event)"
            >
              <option v-if="bedTypeOf(u.bedId) === 'double'" value="upper">上铺</option>
              <option v-if="bedTypeOf(u.bedId) === 'double'" value="lower">下铺</option>
              <option v-if="bedTypeOf(u.bedId) === 'single'" value="single">单人</option>
            </select>
          </div>
        </div>
        <div v-if="membersError" class="banner banner-error">{{ membersError }}</div>
        <div v-if="membersSuccess" class="banner banner-success">{{ membersSuccess }}</div>
        <button class="btn btn-primary" :disabled="membersSaving" @click="saveMembers">
          {{ membersSaving ? '保存中…' : '保存成员设置' }}
        </button>
      </template>
    </section>

    <!-- 密码设置 -->
    <section class="card">
      <div class="card-title">密码设置</div>
      <div class="form-field">
        <label class="form-label" for="pw-current">当前管理密码</label>
        <input
          id="pw-current"
          v-model="pwForm.current"
          type="password"
          class="input"
          placeholder="请输入当前管理密码"
          autocomplete="current-password"
        />
      </div>
      <div class="form-field">
        <label class="form-label" for="pw-viewer">新展示密码</label>
        <input
          id="pw-viewer"
          v-model="pwForm.viewer"
          type="password"
          class="input"
          placeholder="留空则不修改（4-64 位）"
          autocomplete="new-password"
        />
      </div>
      <div class="form-field">
        <label class="form-label" for="pw-admin">新管理密码</label>
        <input
          id="pw-admin"
          v-model="pwForm.admin"
          type="password"
          class="input"
          placeholder="留空则不修改（4-64 位）"
          autocomplete="new-password"
        />
      </div>
      <div v-if="pwError" class="banner banner-error">{{ pwError }}</div>
      <div v-if="pwSuccess" class="banner banner-success">{{ pwSuccess }}</div>
      <button class="btn btn-primary" :disabled="pwSaving" @click="savePasswords">
        {{ pwSaving ? '保存中…' : '保存密码' }}
      </button>
    </section>
  </div>
</template>

<style scoped>
.member-hint {
  margin-bottom: 12px;
}

.member-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}

.member-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

@media (min-width: 768px) {
  .member-row {
    grid-template-columns: 1.2fr 1fr 1fr;
  }
}
</style>
