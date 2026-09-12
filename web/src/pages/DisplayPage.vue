<!-- 展示页（只读 Dashboard）：概览 + 日历/明细 + 趋势 + 个人 + 频次 + 纪律 -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type {
  CalendarStats,
  DailyTrendPoint,
  DisciplineRecord,
  EnrichedRecord,
  FrequencyStats,
  MonthlyTrendPoint,
  OverviewData,
  PersonalStats,
  WeeklyTrendPoint,
} from '@dorm/contracts';
import { statsApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { todayInShanghai } from '../utils/date';
import MButton from '../components/ui/MButton.vue';
import MIcon from '../components/ui/MIcon.vue';
import MThemeToggle from '../components/ui/MThemeToggle.vue';
import DashboardSummary from '../features/dashboard/DashboardSummary.vue';
import CalendarBoard from '../features/calendar/CalendarBoard.vue';
import TrendSection from '../features/analytics/TrendSection.vue';
import PersonalAnalysis from '../features/analytics/PersonalAnalysis.vue';
import FrequencyAnalysis from '../features/analytics/FrequencyAnalysis.vue';
import DisciplineSection from '../features/discipline/DisciplineSection.vue';

const router = useRouter();
const auth = useAuthStore();

const today = todayInShanghai();
const roleLabel = computed(() => (auth.role === 'ADMIN' ? '管理员' : '展示人员'));

async function logout(): Promise<void> {
  await auth.logout();
  await router.push('/login');
}

// ---- 概览 ----
const overview = ref<OverviewData | null>(null);
const overviewLoading = ref(true);
const overviewError = ref('');
async function loadOverview(): Promise<void> {
  overviewLoading.value = true;
  overviewError.value = '';
  try {
    overview.value = await statsApi.overview();
  } catch (e) {
    overviewError.value = errorMessage(e, '成绩概览加载失败');
  } finally {
    overviewLoading.value = false;
  }
}

// ---- 日历 + 单日 ----
const calendar = ref<CalendarStats | null>(null);
const calendarLoading = ref(true);
const calendarError = ref('');
const selectedDay = ref<string | null>(null);
const dayDetail = ref<EnrichedRecord | null>(null);
const dayLoading = ref(false);
const dayError = ref('');
const calendarMonth = ref<string | null>(null);

const selectedScore = computed(
  () => calendar.value?.days.find((d) => d.date === selectedDay.value)?.score ?? null,
);

async function loadCalendar(month?: string | null): Promise<void> {
  calendarLoading.value = true;
  calendarError.value = '';
  try {
    const data = await statsApi.calendar(month);
    calendar.value = data;
    calendarMonth.value = data.selectedMonth;
    selectedDay.value = data.days.some((d) => d.date === today && d.score !== null) ? today : null;
    if (selectedDay.value) void loadDayDetail(selectedDay.value);
    else dayDetail.value = null;
  } catch (e) {
    calendarError.value = errorMessage(e, '日历加载失败');
  } finally {
    calendarLoading.value = false;
  }
}

async function loadDayDetail(date: string): Promise<void> {
  dayLoading.value = true;
  dayError.value = '';
  try {
    dayDetail.value = await statsApi.day(date);
  } catch (e) {
    dayError.value = errorMessage(e, '当日明细加载失败');
  } finally {
    dayLoading.value = false;
  }
}

function onSelectDay(date: string): void {
  selectedDay.value = date;
  dayDetail.value = null;
  dayError.value = '';
  const day = calendar.value?.days.find((d) => d.date === date);
  if (day && day.score !== null) void loadDayDetail(date);
}

// ---- 趋势 ----
const daily = ref<DailyTrendPoint[]>([]);
const weekly = ref<WeeklyTrendPoint[]>([]);
const monthly = ref<MonthlyTrendPoint[]>([]);
const trendLoading = ref(true);
const trendError = ref('');
async function loadTrends(): Promise<void> {
  trendLoading.value = true;
  trendError.value = '';
  try {
    const [d, w, m] = await Promise.all([
      statsApi.dailyTrend(),
      statsApi.weeklyTrend(),
      statsApi.monthlyTrend(),
    ]);
    daily.value = d.points;
    weekly.value = w.points;
    monthly.value = m.points;
  } catch (e) {
    trendError.value = errorMessage(e, '成绩趋势加载失败');
  } finally {
    trendLoading.value = false;
  }
}

// ---- 个人 ----
const personal = ref<PersonalStats | null>(null);
const personalLoading = ref(true);
const personalError = ref('');
const personalMonth = ref<string | null>(null);
async function loadPersonal(month?: string | null): Promise<void> {
  personalLoading.value = true;
  personalError.value = '';
  try {
    personal.value = await statsApi.personal(month);
    personalMonth.value = personal.value.selectedMonth;
  } catch (e) {
    personalError.value = errorMessage(e, '个人分析加载失败');
  } finally {
    personalLoading.value = false;
  }
}

// ---- 频次 ----
const frequency = ref<FrequencyStats | null>(null);
const frequencyLoading = ref(true);
const frequencyError = ref('');
const frequencyMonth = ref<string | null>(null);
async function loadFrequency(month?: string | null): Promise<void> {
  frequencyLoading.value = true;
  frequencyError.value = '';
  try {
    frequency.value = await statsApi.frequency(month);
    frequencyMonth.value = frequency.value.selectedMonth;
  } catch (e) {
    frequencyError.value = errorMessage(e, '卫生扣分频次加载失败');
  } finally {
    frequencyLoading.value = false;
  }
}

// ---- 纪律 ----
const discipline = ref<DisciplineRecord[]>([]);
const disciplineLoading = ref(true);
const disciplineError = ref('');
async function loadDiscipline(): Promise<void> {
  disciplineLoading.value = true;
  disciplineError.value = '';
  try {
    discipline.value = (await statsApi.discipline()).records;
  } catch (e) {
    disciplineError.value = errorMessage(e, '纪律记录加载失败');
  } finally {
    disciplineLoading.value = false;
  }
}

onMounted(() => {
  void loadOverview();
  void loadCalendar();
  void loadTrends();
  void loadPersonal();
  void loadFrequency();
  void loadDiscipline();
});
</script>

<template>
  <div class="display-page">
    <header class="display-topbar">
      <div class="brand">
        <span class="brand-mark"><MIcon name="sparkle" :size="20" /></span>
        <span class="brand-name">DormScore</span>
        <span class="brand-sub type-body-small text-muted">宿舍成绩</span>
      </div>
      <div class="topbar-actions">
        <span class="m-badge m-badge--primary">{{ roleLabel }}</span>
        <MThemeToggle />
        <MButton v-if="auth.role === 'ADMIN'" size="sm" @click="router.push('/admin')">
          管理后台
        </MButton>
        <MButton variant="outlined" size="sm" @click="logout">退出</MButton>
      </div>
    </header>

    <main class="page page-stack display-main">
      <DashboardSummary
        :data="overview"
        :loading="overviewLoading"
        :error="overviewError"
        @retry="loadOverview"
      />

      <CalendarBoard
        :data="calendar"
        :loading="calendarLoading"
        :error="calendarError"
        :selected-day="selectedDay"
        :selected-score="selectedScore"
        :record="dayDetail"
        :day-loading="dayLoading"
        :day-error="dayError"
        @month-change="loadCalendar"
        @select-day="onSelectDay"
        @retry-calendar="loadCalendar(calendarMonth)"
        @retry-day="selectedDay && loadDayDetail(selectedDay)"
      />

      <TrendSection
        :daily="daily"
        :weekly="weekly"
        :monthly="monthly"
        :loading="trendLoading"
        :error="trendError"
        @retry="loadTrends"
      />

      <div class="analytics-grid">
        <PersonalAnalysis
          :data="personal"
          :loading="personalLoading"
          :error="personalError"
          @month-change="loadPersonal"
          @retry="loadPersonal(personalMonth)"
        />
        <FrequencyAnalysis
          :data="frequency"
          :loading="frequencyLoading"
          :error="frequencyError"
          @month-change="loadFrequency"
          @retry="loadFrequency(frequencyMonth)"
        />
      </div>

      <DisciplineSection
        :records="discipline"
        :loading="disciplineLoading"
        :error="disciplineError"
        @retry="loadDiscipline"
      />
    </main>
  </div>
</template>

<style scoped>
.display-page {
  min-height: 100dvh;
  background: var(--md-surface);
}
.display-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: var(--space-3) var(--space-4);
  background: color-mix(in srgb, var(--md-surface) 88%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--md-outline-variant);
}
.brand {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}
.brand-mark {
  display: inline-flex;
  color: var(--md-primary);
  align-self: center;
}
.brand-name {
  font-size: var(--text-title-large);
  font-weight: var(--weight-bold);
  letter-spacing: -0.01em;
  color: var(--md-on-surface);
}
.topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.display-main {
  padding-bottom: var(--space-10);
}
.analytics-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-5);
}
@media (min-width: 1024px) {
  .analytics-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
