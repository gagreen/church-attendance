import { isValidMonth } from '@/lib/date';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StatisticsParams = { classId: string | 'all'; month: string };

// Server Action·Route Handler 공용 입력 검증. 클라이언트/URL에서 온 값은 신뢰하지 않는다.
export function parseStatisticsParams(classId: unknown, month: unknown): StatisticsParams | null {
  if (typeof classId !== 'string' || typeof month !== 'string') return null;
  if (classId !== 'all' && !UUID_PATTERN.test(classId)) return null;
  if (!isValidMonth(month)) return null;
  return { classId, month };
}
