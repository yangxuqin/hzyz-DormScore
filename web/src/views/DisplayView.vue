<!-- 展示页（只读）：概览 + 今日明细 + 本月日历 + 趋势 + 个人分析 + 频次 + 纪律 -->
<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { EChartsOption } from 'echarts';
import { apiGet, errorMessage } from '../api/client';
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
} from '../api/types';
import { useAuthStore } from '../stores/auth';
import { formatDateCn, todayInShanghai, weekdayOf } from '../utils/date';
import { formatRate } from '../utils/deduction';
import EChart from '../components/EChart.vue';
import MonthSwitcher from '../components/MonthSwitcher.vue';
import StateBox from '../components/StateBox.vue';
import StatCard from '../components/StatCard.vue';
import ThemeToggle from '../components/ThemeToggle.vue';

const router = useRouter();
const auth = useAuthStore();

const roleLabel = computed(() => (auth.role === 'ADMIN' ? '管理员' : '展示人员'));
const today = todayInShanghai();

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

const todayRateText = computed(() => {
  const t = overview.value?.today;
  if (!t) return '';
  return `得分率 ${Math.round((t.score / 20) * 100)}%`;
});

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

function rateOption(
  points: { label: string; rate: number; days: number }[],
  name: string,
): EChartsOption {
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0]! : params;
        const point = points[p.dataIndex];
        return point
          ? `${point.label}<br/>得分率：<b>${point.rate}%</b><br/>有效天数：${point.days} 天`
          : '';
      },
    },
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
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', formatter: '{c}%', fontSize: 11 },
      },
    ],
  };
}

const trendOption = computed<EChartsOption>(() => {
  if (trendTab.value === 'daily') {
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const p = Array.isArray(params) ? params[0]! : params;
          const point = dailyPoints.value[p.dataIndex];
          if (!point) return '';
          return [
            `${formatDateCn(point.date)}（得分 <b>${point.score}</b> / 20）`,
            `扣分合计：${point.totalDeduction} 分`,
            `　床位 ${point.bedDeduction} · 公共 ${point.publicDeduction} · 纪律 ${point.disciplineDeduction}（讲话 ${point.talkCount} 次）`,
          ].join('<br/>');
        },
      },
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
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { type: 'dashed', opacity: 0.5 },
            label: { formatter: '满分 20' },
            data: [{ yAxis: 20 }],
          },
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

// ---- 本月日历 ----
const calendar = ref<CalendarStats | null>(null);
const calendarLoading = ref(true);
const calendarError = ref('');
const calendarMonth = ref<string | null>(null);
const selectedDay = ref<string | null>(null);

async function loadCalendar(month?: string): Promise<void> {
  calendarLoading.value = true;
  calendarError.value = '';
  try {
    const data = await apiGet<CalendarStats>('/stats/calendar', { month: month ?? undefined });
    calendar.value = data;
    calendarMonth.value = data.selectedMonth;
    selectedDay.value = data.days.some((d) => d.date === today) ? today : null;
  } catch (e) {
    calendarError.value = errorMessage(e, '日历加载失败');
  } finally {
    calendarLoading.value = false;
  }
}

function onCalendarMonthChange(m: string): void {
  calendarMonth.value = m;
  void loadCalendar(m);
}

function scoreClass(score: number | null): string {
  if (score === null) return 'empty';
  if (score >= 20) return 'full';
  if (score >= 15) return 's1';
  if (score >= 10) return 's2';
  if (score >= 5) return 's3';
  return 's4';
}

const calendarLeading = computed(() => {
  const first = calendar.value?.days[0];
  return first ? Math.max(0, first.weekday - 1) : 0;
});

// ---- 单日明细（日历点选）----
const dayDetail = ref<EnrichedRecord | null>(null);
const dayDetailLoading = ref(false);
const dayDetailError = ref('');

const selectedDayScore = computed(() => {
  const day = calendar.value?.days.find((d) => d.date === selectedDay.value);
  return day?.score ?? null;
});

const selectedDayLeave = computed(
  () =>
    dayDetail.value?.userStatus.filter((s) => s.status === 'LEAVE').map((s) => s.userName) ?? [],
);

async function loadDayDetail(date: string): Promise<void> {
  dayDetailLoading.value = true;
  dayDetailError.value = '';
  try {
    dayDetail.value = await apiGet<EnrichedRecord | null>('/stats/day', { date });
  } catch (e) {
    dayDetailError.value = errorMessage(e, '当日明细加载失败');
  } finally {
    dayDetailLoading.value = false;
    // 手机端：明细加载完成后再次滚进视野，保证新内容可见
    if (window.matchMedia('(max-width: 767px)').matches && selectedDay.value === date) {
      await nextTick();
      document
        .querySelector('.cal-detail')
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

function isToday(date: string): boolean {
  return date === today;
}

/** 选择日历日期：拉取当日完整明细；手机端自动把明细面板滚进视野 */
async function onSelectDay(date: string): Promise<void> {
  selectedDay.value = date;
  dayDetail.value = null;
  dayDetailError.value = '';
  const day = calendar.value?.days.find((d) => d.date === date);
  if (day && day.score !== null) {
    void loadDayDetail(date);
  }
  if (window.matchMedia('(max-width: 767px)').matches) {
    await nextTick();
    document.querySelector('.cal-detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

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

const personalOption = computed<EChartsOption>(() => {
  const users = personal.value?.users ?? [];
  return {
    legend: { top: 0 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        const name = list[0]?.name ?? '';
        const user = users.find((u) => u.name === name);
        if (!user) return '';
        return [
          `<b>${user.name}</b>（本月合计 ${user.deduction} 分）`,
          `床位个人区域：${user.bedDeduction} 分`,
          `值日公共区域：${user.publicDeduction} 分`,
          `本月值日：${user.dutyCount} 天`,
        ].join('<br/>');
      },
    },
    grid: { left: 40, right: 16, top: 34, bottom: 30 },
    xAxis: {
      type: 'category',
      data: users.map((u) => u.name),
      axisLabel: { interval: 0 },
    },
    yAxis: { type: 'value', min: 0, name: '分' },
    series: [
      {
        name: '床位扣分',
        type: 'bar',
        stack: 'total',
        data: users.map((u) => u.bedDeduction),
        barMaxWidth: 36,
      },
      {
        name: '公共区域',
        type: 'bar',
        stack: 'total',
        data: users.map((u) => u.publicDeduction),
        barMaxWidth: 36,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        label: {
          show: true,
          position: 'top',
          formatter: (p) => String(users[p.dataIndex]?.deduction ?? 0),
          fontSize: 11,
        },
      },
    ],
  };
});

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

const frequencyTotal = computed(() =>
  (frequency.value?.items ?? []).reduce((sum, i) => sum + i.count, 0),
);

const frequencyOption = computed<EChartsOption>(() => {
  const items = frequency.value?.items ?? [];
  const total = frequencyTotal.value;
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0]! : params;
        const count = Number(p.value ?? 0);
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
        return `${p.name}<br/>发生次数：<b>${count} 次</b>（占 ${pct}%）`;
      },
    },
    grid: { left: 40, right: 16, top: 30, bottom: 44 },
    xAxis: {
      type: 'category',
      data: items.map((i) => i.label),
      axisLabel: { interval: 0, rotate: 30 },
    },
    yAxis: { type: 'value', min: 0, name: '次' },
    series: [
      {
        name: '发生次数',
        type: 'bar',
        data: items.map((i) => i.count),
        barMaxWidth: 36,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', formatter: '{c}', fontSize: 11 },
      },
    ],
  };
});

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
  void loadCalendar();
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
        <ThemeToggle />
        <button class="btn btn-outline btn-sm" @click="logout">退出登录</button>
      </div>
    </header>

    <main class="page display-main">
      <!-- 成绩概览 + 今日明细 -->
      <section class="card span-2">
        <div class="card-title">成绩概览</div>
        <StateBox v-if="overviewLoading" loading />
        <StateBox v-else-if="overviewError" :error="overviewError" @retry="loadOverview" />
        <template v-else>
          <div class="stats-grid">
            <StatCard
              label="今日得分"
              :value="overview?.today ? String(overview.today.score) : '-'"
              unit="/ 20 分"
              :hint="overview?.today ? todayRateText : '今日暂无记录'"
            />
            <StatCard
              label="今日扣分"
              :value="overview?.today ? String(overview.today.totalDeduction) : '-'"
              unit="分"
              :hint="
                overview?.today
                  ? `床位 ${overview.today.bedDeduction} · 公共 ${overview.today.publicDeduction} · 纪律 ${overview.today.disciplineDeduction}`
                  : '今日暂无记录'
              "
            />
            <StatCard
              label="本周得分率"
              :value="overview?.weekRate ? `${formatRate(overview.weekRate.rate)}%` : '-'"
              :hint="
                overview?.weekRate
                  ? `${overview.weekRate.label} · ${overview.weekRate.days} 个有效日 · 满分 ${overview.weekRate.fullScoreDays} 天`
                  : '本周暂无有效记录'
              "
            />
            <StatCard
              label="本月得分率"
              :value="overview?.monthRate ? `${formatRate(overview.monthRate.rate)}%` : '-'"
              :hint="
                overview?.monthRate
                  ? `${overview.monthRate.label} · ${overview.monthRate.days} 个有效日 · 满分 ${overview.monthRate.fullScoreDays} 天`
                  : '本月暂无有效记录'
              "
            />
          </div>

          <!-- 今日明细 -->
          <div v-if="overview?.today" class="today-detail">
            <div class="today-detail-head">
              <span class="today-detail-date">
                {{ formatDateCn(overview.today.date) }} {{ overview.today.weekday }}
              </span>
              <span
                >值日生：<b>{{ overview.today.dutyUserName }}</b></span
              >
              <span>
                请假：
                <template v-if="overview.today.leaveUsers.length">
                  {{ overview.today.leaveUsers.map((u) => u.name).join('、') }}
                </template>
                <template v-else>无</template>
              </span>
            </div>
            <div class="period-grid">
              <div v-for="p in ['am', 'pm'] as const" :key="p" class="period-block">
                <div class="period-title">{{ p === 'am' ? '上午' : '下午' }}</div>
                <div class="chips">
                  <span
                    v-for="c in overview.today[p].bedChecks"
                    :key="`b-${p}-${c.bedId}-${c.item}`"
                    class="chip chip-bed"
                    >{{ c.bedName }}·{{ c.itemLabel }}</span
                  >
                  <span
                    v-for="c in overview.today[p].publicChecks"
                    :key="`p-${p}-${c.item}`"
                    class="chip chip-public"
                    >{{ c.itemLabel }}</span
                  >
                  <span v-if="overview.today[p].talk > 0" class="chip chip-talk"
                    >讲话 {{ overview.today[p].talk }} 次</span
                  >
                  <span
                    v-if="
                      overview.today[p].bedChecks.length === 0 &&
                      overview.today[p].publicChecks.length === 0 &&
                      overview.today[p].talk === 0
                    "
                    class="chip chip-none"
                    >无扣分项</span
                  >
                </div>
              </div>
            </div>
          </div>
        </template>
      </section>

      <!-- 本月日历 -->
      <section class="card span-2">
        <div class="card-title">
          <span>本月日历</span>
          <MonthSwitcher
            v-if="calendar?.months.length"
            :model-value="calendarMonth"
            :months="calendar.months"
            @update:model-value="onCalendarMonthChange"
          />
        </div>
        <StateBox v-if="calendarLoading" loading />
        <StateBox
          v-else-if="calendarError"
          :error="calendarError"
          @retry="() => loadCalendar(calendarMonth ?? undefined)"
        />
        <template v-else-if="calendar">
          <div class="calendar-wrap">
            <div class="calendar-grid">
              <div
                v-for="w in ['一', '二', '三', '四', '五', '六', '日']"
                :key="w"
                class="cal-head"
              >
                {{ w }}
              </div>
              <div v-for="i in calendarLeading" :key="`lead-${i}`" class="cal-spacer" />
              <button
                v-for="day in calendar.days"
                :key="day.date"
                class="cal-cell"
                :class="[
                  scoreClass(day.score),
                  { today: isToday(day.date), selected: selectedDay === day.date },
                ]"
                type="button"
                :title="
                  day.score === null
                    ? `${formatDateCn(day.date)} 无记录`
                    : `${formatDateCn(day.date)} 得分 ${day.score}`
                "
                @click="onSelectDay(day.date)"
              >
                <span class="cal-day">{{ Number(day.date.slice(-2)) }}</span>
                <span v-if="day.score !== null" class="cal-score">{{ day.score }}</span>
              </button>
            </div>
            <div class="calendar-legend">
              <span><i class="dot heat-full"></i>满分 20</span>
              <span><i class="dot heat-s1"></i>15-19 分</span>
              <span><i class="dot heat-s2"></i>10-14 分</span>
              <span><i class="dot heat-s3"></i>5-9 分</span>
              <span><i class="dot heat-s4"></i>0-4 分</span>
              <span><i class="dot heat-empty"></i>无记录</span>
              <span class="cal-tip">点击日期查看当日得分与扣分</span>
            </div>
          </div>
          <div v-if="selectedDay" class="cal-detail">
            <div class="cal-detail-head">
              <span class="cal-detail-date">
                {{ formatDateCn(selectedDay) }} {{ weekdayOf(selectedDay) }}
              </span>
              <template v-if="selectedDayScore !== null">
                <span class="cal-detail-score"
                  >得分 <b>{{ selectedDayScore }}</b> / 20</span
                >
                <span v-if="dayDetail">
                  扣分 <b>{{ dayDetail.totalDeduction }}</b> 分（床位
                  <b>{{ dayDetail.bedDeduction }}</b> · 公共
                  <b>{{ dayDetail.publicDeduction }}</b> · 纪律
                  <b>{{ dayDetail.disciplineDeduction }}</b
                  >）
                </span>
              </template>
              <span v-else>无记录（非有效日，不计入统计）</span>
            </div>

            <span v-if="dayDetailLoading" class="cal-detail-loading">当日明细加载中…</span>
            <div v-else-if="dayDetailError" class="cal-detail-error">
              {{ dayDetailError }}
              <button type="button" class="link" @click="selectedDay && loadDayDetail(selectedDay)">
                重试
              </button>
            </div>
            <template v-else-if="dayDetail">
              <div class="cal-detail-meta">
                <span
                  >值日生：<b>{{ dayDetail.dutyUserName }}</b></span
                >
                <span>
                  请假：
                  <template v-if="selectedDayLeave.length"
                    ><b>{{ selectedDayLeave.join('、') }}</b></template
                  >
                  <template v-else>无</template>
                </span>
                <span v-if="dayDetail.talkCount > 0"
                  >讲话 <b>{{ dayDetail.talkCount }}</b> 次</span
                >
              </div>
              <div class="period-grid">
                <div v-for="p in ['am', 'pm'] as const" :key="p" class="period-block">
                  <div class="period-title">{{ p === 'am' ? '上午' : '下午' }}</div>
                  <div class="chips">
                    <span
                      v-for="c in dayDetail.bedChecks.filter(
                        (x) => x.period === (p === 'am' ? 'AM' : 'PM'),
                      )"
                      :key="`db-${p}-${c.bedId}-${c.item}`"
                      class="chip chip-bed"
                      >{{ c.bedName }}·{{ c.itemLabel }}</span
                    >
                    <span
                      v-for="c in dayDetail.publicChecks.filter(
                        (x) => x.period === (p === 'am' ? 'AM' : 'PM'),
                      )"
                      :key="`dp-${p}-${c.item}`"
                      class="chip chip-public"
                      >{{ c.itemLabel }}</span
                    >
                    <span
                      v-if="(p === 'am' ? dayDetail.talkAm : dayDetail.talkPm) > 0"
                      class="chip chip-talk"
                      >讲话 {{ p === 'am' ? dayDetail.talkAm : dayDetail.talkPm }} 次</span
                    >
                    <span
                      v-if="
                        dayDetail.bedChecks.filter((x) => x.period === (p === 'am' ? 'AM' : 'PM'))
                          .length === 0 &&
                        dayDetail.publicChecks.filter(
                          (x) => x.period === (p === 'am' ? 'AM' : 'PM'),
                        ).length === 0 &&
                        (p === 'am' ? dayDetail.talkAm : dayDetail.talkPm) === 0
                      "
                      class="chip chip-none"
                      >无扣分项</span
                    >
                  </div>
                </div>
              </div>
            </template>
          </div>
        </template>
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
        <template v-else>
          <EChart :option="personalOption" height="300px" />
          <div class="duty-row">
            <span class="duty-title">本月值日</span>
            <div class="duty-chips">
              <span
                v-for="u in personal?.users"
                :key="u.userId"
                class="badge"
                :class="u.dutyCount > 0 ? 'badge-primary' : 'badge-muted'"
                >{{ u.name }} · {{ u.dutyCount }} 天</span
              >
            </div>
          </div>
        </template>
      </section>

      <!-- 卫生扣分频次 -->
      <section class="card">
        <div class="card-title">
          <span>卫生扣分频次（本月共 {{ frequencyTotal }} 次）</span>
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
        <table v-else class="discipline-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>星期</th>
              <th>上午</th>
              <th>下午</th>
              <th>合计</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in discipline" :key="r.date">
              <td>{{ formatDateCn(r.date) }}</td>
              <td>{{ weekdayOf(r.date) }}</td>
              <td>{{ r.talkAm }} 次</td>
              <td>{{ r.talkPm }} 次</td>
              <td>
                <span class="badge badge-danger">{{ r.count }} 次</span>
              </td>
            </tr>
          </tbody>
        </table>
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

/* 今日明细 */
.today-detail {
  margin-top: 16px;
  border-top: 1px solid var(--color-border);
  padding-top: 14px;
}

.today-detail-head {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 10px;
}

.today-detail-head b {
  color: var(--color-text);
}

.today-detail-date {
  color: var(--color-text);
  font-weight: 600;
}

.period-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.period-block {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
}

.period-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
}

.chip-bed {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.chip-public {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.chip-talk {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.chip-none {
  background: var(--color-bg);
  color: var(--color-muted);
  border-color: var(--color-border);
}

/* 日历 */
.calendar-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  max-width: 520px;
}

.cal-head {
  text-align: center;
  font-size: 12px;
  color: var(--color-text-secondary);
  padding: 4px 0;
}

.cal-spacer {
  aspect-ratio: 1;
}

.cal-cell {
  aspect-ratio: 1;
  min-height: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  border: 2px solid transparent;
  color: var(--heat-text-light);
  transition:
    transform 0.1s ease,
    border-color 0.1s ease,
    box-shadow 0.15s ease;
}

.cal-day {
  line-height: 1;
}

.cal-score {
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  opacity: 0.9;
}

/* 手机端单元格空间有限，只显示日期，分值点选后在明细面板查看 */
@media (max-width: 767px) {
  .cal-score {
    display: none;
  }
}

.cal-cell:hover {
  transform: scale(1.08);
}

.cal-cell.empty {
  background: var(--heat-empty);
  color: var(--color-muted);
  cursor: default;
}

.cal-cell.full {
  background: var(--heat-full);
}

.cal-cell.s1 {
  background: var(--heat-1);
  color: var(--heat-text-dark);
}

.cal-cell.s2 {
  background: var(--heat-2);
  color: var(--heat-text-dark);
}

.cal-cell.s3 {
  background: var(--heat-3);
}

.cal-cell.s4 {
  background: var(--heat-4);
}

.cal-cell.today {
  border-color: var(--color-primary);
}

.cal-cell.selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgb(30 64 175 / 0.25);
}

.calendar-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  font-size: 12px;
  color: var(--color-text-secondary);
  align-items: center;
}

.calendar-legend .dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 5px;
  vertical-align: -1px;
}

.calendar-legend .cal-tip {
  margin-left: auto;
  color: var(--color-text-secondary);
  opacity: 0.85;
}

.dot.heat-full {
  background: var(--heat-full);
}

.dot.heat-s1 {
  background: var(--heat-1);
}

.dot.heat-s2 {
  background: var(--heat-2);
}

.dot.heat-s3 {
  background: var(--heat-3);
}

.dot.heat-s4 {
  background: var(--heat-4);
}

.dot.heat-empty {
  background: var(--heat-empty);
  border: 1px solid var(--color-border);
}

.cal-detail {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
  padding: 12px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: var(--color-text-secondary);
  animation: cal-detail-in 0.25s ease;
}

@keyframes cal-detail-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.cal-detail b {
  color: var(--color-text);
}

.cal-detail-date {
  color: var(--color-text);
  font-weight: 600;
}

.cal-detail-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 18px;
}

.cal-detail-score {
  color: var(--color-text);
}

.cal-detail-score b {
  font-size: 22px;
  color: var(--color-primary);
}

.cal-detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
}

.cal-detail-loading {
  font-size: 13px;
}

.cal-detail-error {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-danger);
}

/* 个人分析值日 */
.duty-row {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.duty-title {
  font-size: 13px;
  color: var(--color-text-secondary);
  font-weight: 600;
}

.duty-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* 纪律表格 */
.discipline-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.discipline-table th,
.discipline-table td {
  text-align: left;
  padding: 10px 8px;
  border-bottom: 1px solid var(--color-border);
}

.discipline-table th {
  color: var(--color-text-secondary);
  font-weight: 500;
  font-size: 13px;
}

.discipline-table tr:last-child td {
  border-bottom: none;
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

  .period-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .calendar-wrap {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
  }

  .calendar-legend {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding-top: 28px;
  }
}
</style>
