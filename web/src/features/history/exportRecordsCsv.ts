// 历史记录 → CSV：把 EnrichedRecord（含扣分池与个人分摊）摊平成一行一条记录
import type { BedItem, EnrichedRecord, Period } from '@dorm/contracts';
import type { CsvCell } from '../../utils/csv';
import { downloadCsv } from '../../utils/csv';
import { PERIOD_LABELS, PUBLIC_ITEM_LABELS } from '../../domain/constants';
import { formatShare } from '../../domain/pools';

const HEADERS: CsvCell[] = [
  '日期',
  '星期',
  '状态',
  '值日生',
  '请假人员',
  '上午床面',
  '上午床下地面',
  '下午床面',
  '下午床下地面',
  '上午公共区域',
  '下午公共区域',
  '上午讲话次数',
  '下午讲话次数',
  '床位扣分',
  '公共区域扣分',
  '纪律扣分',
  '总扣分',
  '得分',
  '床位分摊',
];

function poolBeds(record: EnrichedRecord, period: Period, item: BedItem): string {
  const pool = record.bedChecks.find((p) => p.period === period && p.item === item);
  return pool && pool.bedNames.length > 0 ? pool.bedNames.join('、') : '-';
}

function publicNames(record: EnrichedRecord, period: Period): string {
  const names = record.publicChecks
    .filter((c) => c.period === period)
    .map((c) => PUBLIC_ITEM_LABELS[c.item]);
  return names.length > 0 ? names.join('、') : '-';
}

function leaveNames(record: EnrichedRecord): string {
  const names = record.userStatus.filter((s) => s.status === 'LEAVE').map((s) => s.userName);
  return names.length > 0 ? names.join('、') : '无';
}

/** 各扣分池的责任人与人均分摊；命中床位人员全部请假时个人无人承担 */
function shareText(record: EnrichedRecord): string {
  if (record.bedChecks.length === 0) return '-';
  return record.bedChecks
    .map((pool) => {
      const who =
        pool.responsibleUsers.length > 0
          ? pool.responsibleUsers.map((u) => `${u.name} ${formatShare(u.share)}`).join('、')
          : '全部请假，个人不承担';
      const beds = pool.bedNames.length > 0 ? pool.bedNames.join('、') : '-';
      return `${PERIOD_LABELS[pool.period]}${pool.itemLabel}（${beds}）：${who}`;
    })
    .join('；');
}

export function buildRecordCsvRows(records: EnrichedRecord[]): CsvCell[][] {
  const rows: CsvCell[][] = [HEADERS];
  for (const r of records) {
    rows.push([
      r.date,
      r.weekday,
      r.status === 'ACTIVE' ? '有效' : '已撤回',
      r.dutyUserName,
      leaveNames(r),
      poolBeds(r, 'AM', 'BED'),
      poolBeds(r, 'AM', 'FLOOR'),
      poolBeds(r, 'PM', 'BED'),
      poolBeds(r, 'PM', 'FLOOR'),
      publicNames(r, 'AM'),
      publicNames(r, 'PM'),
      r.talkAm,
      r.talkPm,
      r.bedDeduction,
      r.publicDeduction,
      r.disciplineDeduction,
      r.totalDeduction,
      r.score,
      shareText(r),
    ]);
  }
  return rows;
}

/** 导出当前筛选结果；fileLabel 用于文件名去重（如 "2026-09-01_2026-09-30"） */
export function exportRecordsCsv(records: EnrichedRecord[], fileLabel: string): void {
  const suffix = fileLabel.trim() ? `_${fileLabel.trim()}` : '';
  downloadCsv(`宿舍成绩_历史记录${suffix}.csv`, buildRecordCsvRows(records));
}
