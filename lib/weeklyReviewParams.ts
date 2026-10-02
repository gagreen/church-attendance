import { isSunday, isValidDate } from '@/lib/date';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidClassId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export type ClassReviewParams = { classId: string; date: string };

// 출석 입력 화면 하단 총평용. date는 그 주 아무 날이나 올 수 있다(week_start는 호출부에서 sundayOfWeek로 계산).
export function parseClassReviewParams(classId: unknown, date: unknown): ClassReviewParams | null {
  if (!isValidClassId(classId)) return null;
  if (typeof date !== 'string' || !isValidDate(date)) return null;
  return { classId, date };
}

export type WeeklyOverviewParams = { classId: string | 'all'; weekStart: string };

// 주별 모아보기용. weekStart는 반드시 그 주의 일요일이어야 한다(용어 — "주"의 기준).
export function parseWeeklyOverviewParams(classId: unknown, weekStart: unknown): WeeklyOverviewParams | null {
  if (typeof classId !== 'string') return null;
  if (classId !== 'all' && !isValidClassId(classId)) return null;
  if (typeof weekStart !== 'string' || !isValidDate(weekStart) || !isSunday(weekStart)) return null;
  return { classId, weekStart };
}
