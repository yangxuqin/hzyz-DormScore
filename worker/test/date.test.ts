// 日期工具测试
import { describe, expect, it } from 'vitest';
import {
  isValidDateString,
  mondayOf,
  monthKeyOf,
  sundayOf,
  todayInShanghai,
  weekdayName,
  weekdayOf,
  weekLabel,
} from '../src/shared/date';

describe('weekdayOf / weekdayName', () => {
  it('2026-08-16 是星期日（1.md 示例）', () => {
    expect(weekdayOf('2026-08-16')).toBe(7);
    expect(weekdayName('2026-08-16')).toBe('星期日');
  });
  it('2026-08-17 是星期一', () => {
    expect(weekdayOf('2026-08-17')).toBe(1);
    expect(weekdayName('2026-08-17')).toBe('星期一');
  });
});

describe('周（周一~周日）', () => {
  it('mondayOf：周日归属本周一', () => {
    expect(mondayOf('2026-08-16')).toBe('2026-08-10');
    expect(mondayOf('2026-08-17')).toBe('2026-08-17');
    expect(mondayOf('2026-08-10')).toBe('2026-08-10');
  });
  it('sundayOf / weekLabel', () => {
    expect(sundayOf('2026-08-10')).toBe('2026-08-16');
    expect(weekLabel('2026-08-10')).toBe('08/10-08/16');
  });
});

describe('日期工具', () => {
  it('isValidDateString 严格校验', () => {
    expect(isValidDateString('2026-08-16')).toBe(true);
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('2026-13-01')).toBe(false);
    expect(isValidDateString('2026-8-16')).toBe(false);
    expect(isValidDateString('abc')).toBe(false);
    expect(isValidDateString('')).toBe(false);
  });
  it('monthKeyOf', () => {
    expect(monthKeyOf('2026-08-16')).toBe('2026-08');
  });
  it('todayInShanghai 返回合法 YYYY-MM-DD', () => {
    expect(isValidDateString(todayInShanghai())).toBe(true);
  });
});
