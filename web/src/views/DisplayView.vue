<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { EChartsOption } from 'echarts';
import { apiGet, errorMessage } from '../api/client';
import type {
  DailyTrendPoint,
  DisciplineRecord,
  FrequencyStats,
  MonthlyTrendPoint,
  OverviewData,
  PersonalStats,
  WeeklyTrendPoint,
} from '../api/types';
import { useAuthStore } from '../stores/auth';
import { formatDateCn } from '../utils/date';
import { formatRate } from '../utils/deduction';
import EChart from '../components/EChart.vue';
import MonthSwitcher from '../components/MonthSwitcher.vue';
import StateBox from '../components/StateBox.vue';
import StatCard from '../components/StatCard.vue';

const router = useRouter();
const auth = useAuthStore();

const roleLabel = computed(() => (auth.role === 'ADMIN' ? '管理员' : '展示人员'));

async function logout(): Promise<void> {
  await auth.logout();
  await router.push('/login');
}

// ---- 成绩概览 ----
const overview = ref<OverviewData | null>(null);
const overviewLoading = ref(true);
const overviewError = ref('');

async function loadOverview(): Promise<void> {
  overviewLoading.value = true;
  overviewError.value = '';
  try {
    overview.value = await apiGet<OverviewData>('/stats/overview');
  } catch (e) {
    overviewError.value = errorMessage(e, '成绩概览加载失败');
  } finally {
    overviewLoading.value = false;
  }
}

// ---- 成绩趋势 ----
type TrendTab = 'daily' | 'weekly' | 'monthly';
const trendTab = ref<TrendTab>('daily');
const dailyPoints = ref<DailyTrendPoint[]>([]);
const weeklyPoints = ref<WeeklyTrendPoint[]>([]);
const monthlyPoints = ref<MonthlyTrendPoint[]>([]);
const trendLoading = ref(true);
const trendError = ref('');

async function loadTrends(): Promise<void> {
  trendLoading.value = true;
  trendError.value = '';
  try {
    const [daily, weekly, monthly] = await Promise.all([
      apiGet<{ points: DailyTrendPoint[] }>('/stats/trend/daily'),
      apiGet<{ points: WeeklyTrendPoint[] }>('/stats/trend/weekly'),
      apiGet<{ points: MonthlyTrendPoint[] }>('/stats/trend/monthly'),
    ]);
    dailyPoints.value = daily.points;
    weeklyPoints.value = weekly.points;
    monthlyPoints.value = monthly.points;
  } catch (e) {
    trendError.value = errorMessage(e, '成绩趋势加载失败');
  } finally {
    trendLoading.value = false;
  }
}

function rateOption(points: { label: string; rate: number }[], name: string): EChartsOption {
  return {
    tooltip: { trigger: 'axis', formatter: '{b}<br/>{c}%' },
    grid: { left: 44, right: 16, top: 34, bottom: 44 },
    xAxis: {
      type: 'category',
      data: points.map((p) => p.label),
      axisLabel: { rotate: 45 },
    },
    yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [
      {
        name,
        type: 'bar',
        data: points.map((p) => p.rate),
        barMaxWidth: 48,
        itemStyle: { color: '#2563eb', borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', formatter: '{c}%', fontSize: 11 },
      },
    ],
  };
}

const trendOption = computed<EChartsOption>(() => {
  if (trendTab.value === 'daily') {
    return {
      tooltip: { trigger: 'axis', formatter: '{b}<br/>得分：{c}分' },
      grid: { left: 44, right: 16, top: 24, bottom: 44 },
      xAxis: {
        type: 'category',
        data: dailyPoints.value.map((p) => p.date),
        axisLabel: { rotate: dailyPoints.value.length > 10 ? 45 : 0 },
      },
      yAxis: { type: 'value', min: 0, max: 20, name: '分' },
      series: [
        {
          name: '日得分',
          type: 'line',
          data: dailyPoints.value.map((p) => p.score),
          smooth: true,
          symbolSize: 6,
          lineStyle: { width: 2 },
          areaStyle: { opacity: 0.1 },
          itemStyle: { color: '#2563eb' },
        },
      ],
    };
  }
  if (trendTab.value === 'weekly') {
    return rateOption(weeklyPoints.value, '周得分率');
  }
  return rateOption(monthlyPoints.value, '月得分率');
});

const trendEmpty = computed(() => {
  if (trendTab.value === 'daily') return dailyPoints.value.length === 0;
  if (trendTab.value === 'weekly') return weeklyPoints.value.length === 0;
  return monthlyPoints.value.length === 0;
});

// ---- 个人分析 ----
const personal = ref<PersonalStats | null>(null);
const personalLoading = ref(true);
const personalError = ref('');
const personalMonth = ref<string | null>(null);

async function loadPersonal(month?: string): Promise<void> {
  personalLoading.value = true;
  personalError.value = '';
  try {
    const data = await apiGet<PersonalStats>('/stats/personal', { month: month ?? undefined });
    personal.value = data;
    personalMonth.value = data.selectedMonth;
  } catch (e) {
    personalError.value = errorMessage(e, '个人分析加载失败');
  } finally {
    personalLoading.value = false;
  }
}

function onPersonalMonthChange(m: string): void {
  personalMonth.value = m;
  void loadPersonal(m);
}

function retryPersonal(): void {
  void loadPersonal(personalMonth.value ?? undefined);
}

const personalOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis', formatter: '{b}<br/>累计扣分：{c}分' },
  grid: { left: 40, right: 16, top: 30, bottom: 30 },
  xAxis: {
    type: 'category',
    data: personal.value?.users.map((u) => u.name) ?? [],
    axisLabel: { interval: 0 },
  },
  yAxis: { type: 'value', min: 0, name: '分' },
  series: [
    {
      name: '个人累计扣分',
      type: 'bar',
      data: personal.value?.users.map((u) => u.deduction) ?? [],
      barMaxWidth: 36,
      itemStyle: { color: '#2563eb', borderRadius: [4, 4, 0, 0] },
      label: { show: true, position: 'top', formatter: '{c}', fontSize: 11 },
    },
  ],
}));

const personalEmpty = computed(() => !personal.value || personal.value.users.length === 0);

// ---- 卫生扣分频次 ----
const frequency = ref<FrequencyStats | null>(null);
const frequencyLoading = ref(true);
const frequencyError = ref('');
const frequencyMonth = ref<string | null>(null);

async function loadFrequency(month?: string): Promise<void> {
  frequencyLoading.value = true;
  frequencyError.value = '';
  try {
    const data = await apiGet<FrequencyStats>('/stats/frequency', { month: month ?? undefined });
    frequency.value = data;
    frequencyMonth.value = data.selectedMonth;
  } catch (e) {
    frequencyError.value = errorMessage(e, '卫生扣分频次加载失败');
  } finally {
    frequencyLoading.value = false;
  }
}

function onFrequencyMonthChange(m: string): void {
  frequencyMonth.value = m;
  void loadFrequency(m);
}

function retryFrequency(): void {
  void loadFrequency(frequencyMonth.value ?? undefined);
}

const frequencyOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis', formatter: '{b}<br/>发生次数：{c}次' },
  grid: { left: 40, right: 16, top: 30, bottom: 44 },
  xAxis: {
    type: 'category',
    data: frequency.value?.items.map((i) => i.label) ?? [],
    axisLabel: { interval: 0, rotate: 30 },
  },
  yAxis: { type: 'value', min: 0, name: '次' },
  series: [
    {
      name: '发生次数',
      type: 'bar',
      data: frequency.value?.items.map((i) => i.count) ?? [],
      barMaxWidth: 36,
      itemStyle: { color: '#2563eb', borderRadius: [4, 4, 0, 0] },
      label: { show: true, position: 'top', formatter: '{c}', fontSize: 11 },
    },
  ],
}));

const frequencyEmpty = computed(() => !frequency.value || frequency.value.items.length === 0);

// ---- 纪律记录 ----
const discipline = ref<DisciplineRecord[]>([]);
const disciplineLoading = ref(true);
const disciplineError = ref('');

async function loadDiscipline(): Promise<void> {
  disciplineLoading.value = true;
  disciplineError.value = '';
  try {
    const data = await apiGet<{ records: DisciplineRecord[] }>('/stats/discipline');
    discipline.value = data.records;
  } catch (e) {
    disciplineError.value = errorMessage(e, '纪律记录加载失败');
  } finally {
    disciplineLoading.value = false;
  }
}

onMounted(() => {
  void loadOverview();
  void loadTrends();
  void loadPersonal();
  void loadFrequency();
  void loadDiscipline();
});
</script>

<template>
  <div class="display-page">
    <header class="topbar">
      <div class="brand">宿舍分数系统</div>
      <div class="topbar-actions">
        <span class="badge badge-primary">{{ roleLabel }}</span>
        <button class="btn btn-outline btn-sm" @click="logout">退出登录</button>
      </div>
    </header>

    <main class="page display-main">
      <!-- 成绩概览 -->
      <section class="card span-2">
        <div class="card-title">成绩概览</div>
        <StateBox v-if="overviewLoading" loading />
        <StateBox v-else-if="overviewError" :error="overviewError" @retry="loadOverview" />
        <div v-else class="stats-grid">
          <StatCard
            label="今日得分"
            :value="overview?.today ? String(overview.today.score) : '-'"
            unit="分"
            :hint="
              overview?.today ? `${formatDateCn(overview.today.date)} 有效记录` : '今日暂无记录'
            "
          />
          <StatCard
            label="今日扣分"
            :value="overview?.today ? String(overview.today.totalDeduction) : '-'"
            unit="分"
            :hint="
              overview?.today ? `含纪律 ${overview.today.disciplineDeduction} 分` : '今日暂无记录'
            "
          />
          <StatCard
            label="本周得分率"
            :value="overview?.weekRate ? `${formatRate(overview.weekRate.rate)}%` : '-'"
            :hint="
              overview?.weekRate
                ? `${overview.weekRate.label} · ${overview.weekRate.days} 个有效日`
                : '本周暂无有效记录'
            "
          />
          <StatCard
            label="本月得分率"
            :value="overview?.monthRate ? `${formatRate(overview.monthRate.rate)}%` : '-'"
            :hint="
              overview?.monthRate
                ? `${overview.monthRate.label} · ${overview.monthRate.days} 个有效日`
                : '本月暂无有效记录'
            "
          />
        </div>
      </section>

      <!-- 成绩趋势 -->
      <section class="card span-2">
        <div class="card-title">
          <span>成绩趋势</span>
          <div class="segmented">
            <button :class="{ active: trendTab === 'daily' }" @click="trendTab = 'daily'">
              日得分
            </button>
            <button :class="{ active: trendTab === 'weekly' }" @click="trendTab = 'weekly'">
              周得分率
            </button>
            <button :class="{ active: trendTab === 'monthly' }" @click="trendTab = 'monthly'">
              月得分率
            </button>
          </div>
        </div>
        <StateBox v-if="trendLoading" loading />
        <StateBox v-else-if="trendError" :error="trendError" @retry="loadTrends" />
        <StateBox
          v-else-if="trendEmpty"
          empty
          :empty-text="`暂无${trendTab === 'daily' ? '日得分' : trendTab === 'weekly' ? '周得分率' : '月得分率'}数据`"
        />
        <EChart v-else :option="trendOption" height="320px" />
      </section>

      <!-- 个人分析 -->
      <section class="card">
        <div class="card-title">
          <span>个人分析（月累计扣分）</span>
          <MonthSwitcher
            v-if="personal?.months.length"
            :model-value="personalMonth"
            :months="personal.months"
            @update:model-value="onPersonalMonthChange"
          />
        </div>
        <StateBox v-if="personalLoading" loading />
        <StateBox v-else-if="personalError" :error="personalError" @retry="retryPersonal" />
        <StateBox v-else-if="personalEmpty" empty empty-text="暂无个人扣分数据" />
        <EChart v-else :option="personalOption" height="320px" />
      </section>

      <!-- 卫生扣分频次 -->
      <section class="card">
        <div class="card-title">
          <span>卫生扣分频次</span>
          <MonthSwitcher
            v-if="frequency?.months.length"
            :model-value="frequencyMonth"
            :months="frequency.months"
            @update:model-value="onFrequencyMonthChange"
          />
        </div>
        <StateBox v-if="frequencyLoading" loading />
        <StateBox v-else-if="frequencyError" :error="frequencyError" @retry="retryFrequency" />
        <StateBox v-else-if="frequencyEmpty" empty empty-text="暂无频次数据" />
        <EChart v-else :option="frequencyOption" height="320px" />
      </section>

      <!-- 纪律记录 -->
      <section class="card span-2">
        <div class="card-title">纪律记录</div>
        <StateBox v-if="disciplineLoading" loading />
        <StateBox v-else-if="disciplineError" :error="disciplineError" @retry="loadDiscipline" />
        <StateBox v-else-if="discipline.length === 0" empty empty-text="暂无违纪记录" />
        <ul v-else class="discipline-list">
          <li v-for="r in discipline" :key="r.date" class="discipline-item">
            <span class="discipline-date">{{ formatDateCn(r.date) }}</span>
            <span class="discipline-count">{{ r.count }} 次</span>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>

<style scoped>
.display-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.discipline-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.discipline-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 4px;
  border-bottom: 1px solid var(--color-border);
}

.discipline-item:last-child {
  border-bottom: none;
}

.discipline-date {
  font-weight: 500;
}

.discipline-count {
  color: var(--color-danger);
  font-weight: 600;
}

@media (min-width: 768px) {
  .display-main {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }

  .span-2 {
    grid-column: span 2;
  }

  .stats-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
