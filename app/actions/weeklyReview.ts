'use server';

import { requireTeacher } from '@/lib/auth';
import { sundayOfWeek, thisWeekSundayInKST } from '@/lib/date';
import { toFailure, type SaveResult } from '@/lib/actionResult';
import { listAccessibleClasses, type ClassOption } from '@/lib/db/classes';
import {
  addReviewReply as dbAddReviewReply,
  countActiveStudentsByClass,
  deleteReviewReply as dbDeleteReviewReply,
  getClassReview as dbGetClassReview,
  listClassReviews,
  listWeeklyAttendance,
  upsertClassReview,
} from '@/lib/db/weeklyReview';
import { buildWeeklyOverview, type ClassReview, type WeeklyOverview } from '@/lib/weeklyOverview';
import { parseClassReviewParams, parseWeeklyOverviewParams } from '@/lib/weeklyReviewParams';

export type { ClassReview, ReviewReply, WeeklyClassCard, WeeklyOverview } from '@/lib/weeklyOverview';
export type { ClassOption } from '@/lib/db/classes';

// 출석 입력 화면 하단 총평. week_start는 서버에서 sundayOfWeek로 계산한다 — 평일 날짜를 열어도 그 주 총평이 보인다.
export async function getClassReview(params: { classId: string; date: string }): Promise<ClassReview> {
  const teacher = await requireTeacher();
  const parsed = parseClassReviewParams(params.classId, params.date);
  if (!parsed) throw new Error('잘못된 총평 조회 조건입니다.');
  return dbGetClassReview(sundayOfWeek(parsed.date), parsed.classId, teacher.id);
}

export type SaveClassReviewResult =
  | { ok: true; lastModifiedByName: string; lastModifiedAt: string }
  | { ok: false; error: string };

export async function saveClassReview(params: {
  classId: string;
  date: string;
  body: string;
}): Promise<SaveClassReviewResult> {
  const teacher = await requireTeacher();
  try {
    const parsed = parseClassReviewParams(params.classId, params.date);
    if (!parsed) return { ok: false, error: '저장에 실패했습니다. 다시 시도해 주세요.' };
    const { lastModifiedByName, lastModifiedAt } = await upsertClassReview({
      weekStart: sundayOfWeek(parsed.date),
      classId: parsed.classId,
      body: params.body,
      teacherId: teacher.id,
    });
    return { ok: true, lastModifiedByName, lastModifiedAt };
  } catch (e) {
    return toFailure('총평 저장 실패', e, '저장에 실패했습니다. 다시 시도해 주세요.');
  }
}

export type WeeklyOverviewInitialContext = { classOptions: ClassOption[]; defaultWeekStart: string };

export async function getWeeklyOverviewInitialContext(): Promise<WeeklyOverviewInitialContext> {
  await requireTeacher();
  return { classOptions: await listAccessibleClasses(), defaultWeekStart: thisWeekSundayInKST() };
}

// 통계 > 주별 모아보기. classId가 'all'이면 접근 가능한 전체 반, 아니면 그 반 하나만 카드로 내려준다.
export async function getWeeklyOverview(params: { weekStart: string; classId: string }): Promise<WeeklyOverview> {
  const teacher = await requireTeacher();
  const parsed = parseWeeklyOverviewParams(params.classId, params.weekStart);
  if (!parsed) throw new Error('잘못된 주별 모아보기 조회 조건입니다.');

  const allClasses = await listAccessibleClasses();
  const classes = parsed.classId === 'all' ? allClasses : allClasses.filter((c) => c.id === parsed.classId);
  if (classes.length === 0) return { weekStart: parsed.weekStart, cards: [] };

  const classIds = classes.map((c) => c.id);
  const [attendanceRows, reviews, activeStudentCounts] = await Promise.all([
    listWeeklyAttendance(parsed.weekStart, classIds),
    listClassReviews(parsed.weekStart, classIds, teacher.id),
    countActiveStudentsByClass(classIds),
  ]);

  return buildWeeklyOverview({
    weekStart: parsed.weekStart,
    classes: classes.map((c) => ({ classId: c.id, className: c.name })),
    activeStudentCounts,
    attendanceRows,
    reviews,
  });
}

export async function addReviewReply(params: { reviewId: string; body: string }): Promise<SaveResult> {
  const teacher = await requireTeacher();
  try {
    const trimmed = params.body.trim();
    if (trimmed === '') return { ok: false, error: '답글 내용을 입력해 주세요.' };
    await dbAddReviewReply({ reviewId: params.reviewId, body: trimmed, teacherId: teacher.id });
    return { ok: true };
  } catch (e) {
    return toFailure('답글 등록 실패', e, '답글 등록에 실패했습니다. 다시 시도해 주세요.');
  }
}

export async function deleteReviewReply(params: { replyId: string }): Promise<SaveResult> {
  await requireTeacher();
  try {
    await dbDeleteReviewReply(params.replyId);
    return { ok: true };
  } catch (e) {
    return toFailure('답글 삭제 실패', e, '삭제에 실패했습니다. 다시 시도해 주세요.');
  }
}
