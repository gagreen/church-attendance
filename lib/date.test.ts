import { describe, expect, it } from 'vitest';
import { addDays, calendarMonthGrid, formatDateDotted, formatDateLabel, isSunday, sundayOfWeek } from './date';

describe('sundayOfWeek', () => {
  it('오늘이 일요일이면 그대로 반환', () => {
    expect(sundayOfWeek('2026-09-20')).toBe('2026-09-20');
  });

  it('주중 아무 요일이든 그 주의 일요일로 계산', () => {
    expect(sundayOfWeek('2026-09-22')).toBe('2026-09-20'); // 화요일
    expect(sundayOfWeek('2026-09-26')).toBe('2026-09-20'); // 토요일
  });

  it('월 경계를 넘어가는 주도 정확히 계산', () => {
    expect(sundayOfWeek('2026-10-01')).toBe('2026-09-27');
  });
});

describe('addDays', () => {
  it('일 단위 이동, 월/연 경계 처리', () => {
    expect(addDays('2026-09-20', 1)).toBe('2026-09-21');
    expect(addDays('2026-09-20', -1)).toBe('2026-09-19');
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('isSunday', () => {
  it('일요일만 true', () => {
    expect(isSunday('2026-09-20')).toBe(true);
    expect(isSunday('2026-09-21')).toBe(false);
  });
});

describe('formatDateLabel', () => {
  it('YYYY.MM.DD(요일) 형식', () => {
    expect(formatDateLabel('2026-09-20')).toBe('2026.09.20(일)');
  });
});

describe('formatDateDotted', () => {
  it('YYYY-MM-DD를 YYYY.MM.DD로 변환', () => {
    expect(formatDateDotted('2026-08-15')).toBe('2026.08.15');
  });

  it('timestamptz ISO 문자열도 날짜 부분만 변환', () => {
    expect(formatDateDotted('2026-08-15T10:23:00.000Z')).toBe('2026.08.15');
  });
});

describe('calendarMonthGrid', () => {
  it('42칸(6주)을 반환하고 해당 월 1일을 포함한다', () => {
    const grid = calendarMonthGrid(2026, 9);
    expect(grid).toHaveLength(42);
    expect(grid.some((c) => c.date === '2026-09-01' && c.inMonth)).toBe(true);
    expect(grid.some((c) => c.date === '2026-09-30' && c.inMonth)).toBe(true);
  });

  it('앞뒤 달 날짜는 inMonth=false로 채운다', () => {
    const grid = calendarMonthGrid(2026, 9);
    expect(grid[0].inMonth).toBe(false); // 9/1이 화요일이라 앞에 8월 날짜가 채워짐
    expect(grid[grid.length - 1].date > '2026-09-30').toBe(true);
  });
});
