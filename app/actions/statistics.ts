'use server';

import { requireTeacher } from '@/lib/auth';
import { currentMonthInKST } from '@/lib/date';
import { listAccessibleClasses, type ClassOption } from '@/lib/db/classes';
import { getClassStatisticsResult, type ClassStatisticsResult } from '@/lib/db/statistics';
import { parseStatisticsParams } from '@/lib/statisticsParams';

export type {
  ClassStatRow,
  ClassStatisticsResult,
  StatusCounts,
  StudentStatRow,
} from '@/lib/db/statistics';

export type StatisticsInitialContext = {
  classOptions: ClassOption[];
  defaultMonth: string; // YYYY-MM (KST 기준 이번 달)
};

export async function getStatisticsInitialContext(): Promise<StatisticsInitialContext> {
  await requireTeacher();
  return { classOptions: await listAccessibleClasses(), defaultMonth: currentMonthInKST() };
}

export type GetClassStatisticsParams = { classId: string | 'all'; month: string }; // month: YYYY-MM

export async function getClassStatistics(params: GetClassStatisticsParams): Promise<ClassStatisticsResult> {
  await requireTeacher();
  const parsed = parseStatisticsParams(params.classId, params.month);
  if (!parsed) throw new Error('잘못된 통계 조회 조건입니다.');
  return getClassStatisticsResult(parsed.classId, parsed.month);
}
