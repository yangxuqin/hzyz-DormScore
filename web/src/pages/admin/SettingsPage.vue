<!-- 管理 · 设置：成员管理 + 密码管理 -->
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import type { AppConfig, MemberInput } from '@dorm/contracts';
import { errorMessage } from '../../api/client';
import { adminApi, configApi } from '../../api/endpoints';
import { showToast } from '../../composables/useToast';
import MButton from '../../components/ui/MButton.vue';
import MCard from '../../components/ui/MCard.vue';
import MIcon from '../../components/ui/MIcon.vue';
import MStateBox from '../../components/ui/MStateBox.vue';

// ---- 成员设置 ----
const config = ref<AppConfig | null>(null);
const loading = ref(true);
const error = ref('');
const usersForm = ref<MemberInput[]>([]);
const membersSaving = ref(false);
const membersError = ref('');

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
  if (!config.value) return '配置未加载';
  if (users.length !== config.value.users.length)
    return `成员数量必须为 ${config.value.users.length} 人`;
  for (const u of users) {
    const name = u.name.trim();
    if (name.length < 1 || name.length > 20) return '成员姓名需为 1-20 个字符';
    const bed = config.value.beds.find((b) => b.id === u.bedId);
    if (!bed) return `成员「${name}」的床位无效`;
    if (bed.type === 'double' && u.position !== 'upper' && u.position !== 'lower') {
      return `成员「${name}」的铺位无效`;
    }
    if (bed.type === 'single' && u.position !== 'single') {
      return `成员「${name}」在单人床只能选择单人铺位`;
    }
  }
  for (const bed of config.value.beds) {
    const members = users.filter((u) => u.bedId === bed.id);
    if (bed.type === 'double') {
      const upper = members.filter((u) => u.position === 'upper').length;
      const lower = members.filter((u) => u.position === 'lower').length;
      if (upper !== 1 || lower !== 1) return `「${bed.name}」需恰好一上一下`;
    } else if (members.length !== 1) {
      return `「${bed.name}」需恰好一人`;
    }
  }
  return null;
}

async function saveMembers(): Promise<void> {
  membersError.value = '';
  const validation = validateMembers();
  if (validation) {
    membersError.value = validation;
    return;
  }
  membersSaving.value = true;
  try {
    const data = await configApi.updateMembers(
      usersForm.value.map((u) => ({ ...u, name: u.name.trim() })),
    );
    config.value = data;
    usersForm.value = data.users.map((u) => ({
      id: u.id,
      name: u.name,
      bedId: u.bedId,
      position: u.position,
    }));
    showToast('成员设置已保存', 'success');
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

async function savePasswords(): Promise<void> {
  pwError.value = '';
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
      {
        currentAdminPassword: pwForm.current,
      };
    if (pwForm.viewer) body.viewerPassword = pwForm.viewer;
    if (pwForm.admin) body.adminPassword = pwForm.admin;
    await adminApi.changePasswords(body);
    showToast('密码修改成功', 'success');
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
    config.value = await configApi.get();
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

    <MCard variant="elevated">
      <div class="card-title">
        <span><MIcon name="person" :size="18" /> 成员管理</span>
      </div>
      <p class="m-hint member-hint">姓名 1-20 字；上下铺床需恰好一上一下，单人床需恰好一人</p>

      <MStateBox :loading="loading" :error="error" @retry="loadConfig">
        <template v-if="config">
          <div class="member-list">
            <div v-for="u in usersForm" :key="u.id" class="member-row">
              <input
                v-model="u.name"
                class="m-input"
                placeholder="姓名"
                maxlength="20"
                aria-label="成员姓名"
              />
              <select
                class="m-select"
                :value="u.bedId"
                aria-label="床位"
                @change="onUserBedChange(u, $event)"
              >
                <option v-for="b in config.beds" :key="b.id" :value="b.id">{{ b.name }}</option>
              </select>
              <select
                class="m-select"
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
          <div v-if="membersError" class="m-banner m-banner--error">{{ membersError }}</div>
          <MButton :disabled="membersSaving" @click="saveMembers">
            {{ membersSaving ? '保存中…' : '保存成员设置' }}
          </MButton>
        </template>
      </MStateBox>
    </MCard>

    <MCard variant="elevated">
      <div class="card-title">
        <span><MIcon name="lock" :size="18" /> 密码设置</span>
      </div>
      <div class="m-field">
        <label class="m-field-label" for="pw-current">当前管理密码</label>
        <input
          id="pw-current"
          v-model="pwForm.current"
          type="password"
          class="m-input"
          placeholder="请输入当前管理密码"
          autocomplete="current-password"
        />
      </div>
      <div class="m-field" style="margin-top: var(--space-4)">
        <label class="m-field-label" for="pw-viewer">新展示密码</label>
        <input
          id="pw-viewer"
          v-model="pwForm.viewer"
          type="password"
          class="m-input"
          placeholder="留空则不修改（4-64 位）"
          autocomplete="new-password"
        />
      </div>
      <div class="m-field" style="margin-top: var(--space-4)">
        <label class="m-field-label" for="pw-admin">新管理密码</label>
        <input
          id="pw-admin"
          v-model="pwForm.admin"
          type="password"
          class="m-input"
          placeholder="留空则不修改（4-64 位）"
          autocomplete="new-password"
        />
      </div>
      <div v-if="pwError" class="m-banner m-banner--error" style="margin-top: var(--space-4)">
        {{ pwError }}
      </div>
      <MButton :disabled="pwSaving" style="margin-top: var(--space-4)" @click="savePasswords">
        {{ pwSaving ? '保存中…' : '保存密码' }}
      </MButton>
    </MCard>
  </div>
</template>

<style scoped>
.member-hint {
  margin-bottom: var(--space-4);
}
.member-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
.member-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-2);
}
@media (min-width: 768px) {
  .member-row {
    grid-template-columns: 1.4fr 1fr 1fr;
  }
}
</style>
