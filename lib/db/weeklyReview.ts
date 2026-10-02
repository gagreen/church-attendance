import { createClient } from '@/lib/supabase/server';
import type { TablesInsert } from '@/lib/database.types';
import { UserFacingError, assertAffected } from '@/lib/db/errors';
import { addDays } from '@/lib/date';
import type { AttendanceStatus } from '@/lib/db/attendance';
import { EMPTY_CLASS_REVIEW, type ClassReview, type WeeklyAttendanceRow } from '@/lib/weeklyOverview';

// teachers는 본인·관리자만 select 가능해서(teachers_select_self), 총평 마지막 수정자·답글 작성자 이름은
// list_teacher_names(security definer, 0009)로만 읽는다 — list_attendance_teachers와 같은 이유.
async function nameById(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('list_teacher_names', { ids: [...new Set(ids)] });
  if (error) throw new Error(`교사 이름 조회 실패: ${error.message}`);
  return new Map((data ?? []).map((t) => [t.id, t.name]));
}

// (주, 반들)의 총평 + 답글을 한 번에 조회한다. 저장된 적 없는 반은 결과 Map에서 생략된다
// (호출부에서 EMPTY_CLASS_REVIEW로 채운다 — buildWeeklyOverview가 그렇게 한다).
export async function listClassReviews(
  weekStart: string,
  classIds: string[],
  viewerId: string
): Promise<Map<string, ClassReview>> {
  if (classIds.length === 0) return new Map();
  const supabase = await createClient();

  const { data: reviews, error } = await supabase
    .from('class_weekly_reviews')
    .select('id, class_id, body, last_modified_by, last_modified_at')
    .eq('week_start', weekStart)
    .in('class_id', classIds);
  if (error) throw new Error(`class_weekly_reviews 조회 실패: ${error.message}`);
  if (!reviews || reviews.length === 0) return new Map();

  const reviewIds = reviews.map((r) => r.id);
  const { data: replies, error: repliesError } = await supabase
    .from('class_review_replies')
    .select('id, review_id, body, created_by, created_at')
    .in('review_id', reviewIds)
    .order('created_at', { ascending: true });
  if (repliesError) throw new Error(`class_review_replies 조회 실패: ${repliesError.message}`);

  const names = await nameById([...reviews.map((r) => r.last_modified_by), ...(replies ?? []).map((r) => r.created_by)]);

  type ReplyRow = { id: string; review_id: string; body: string; created_by: string; created_at: string };
  const repliesByReview = new Map<string, ReplyRow[]>();
  for (const reply of replies ?? []) {
    repliesByReview.set(reply.review_id, [...(repliesByReview.get(reply.review_id) ?? []), reply]);
  }

  return new Map(
    reviews.map((r) => [
      r.class_id,
      {
        reviewId: r.id,
        body: r.body,
        lastModifiedByName: names.get(r.last_modified_by) ?? '알 수 없음',
        lastModifiedAt: r.last_modified_at,
        replies: (repliesByReview.get(r.id) ?? []).map((reply) => ({
          id: reply.id,
          body: reply.body,
          authorName: names.get(reply.created_by) ?? '알 수 없음',
          createdAt: reply.created_at,
          mine: reply.created_by === viewerId,
        })),
      } satisfies ClassReview,
    ])
  );
}

export async function getClassReview(weekStart: string, classId: string, viewerId: string): Promise<ClassReview> {
  const map = await listClassReviews(weekStart, [classId], viewerId);
  return map.get(classId) ?? EMPTY_CLASS_REVIEW;
}

// upsert(onConflict: 'week_start,class_id')로만 쓴다. recorded_* 보존과 last_modified_at 갱신은 DB 트리거
// (class_weekly_reviews_set_audit_fields, 0009)가 담당한다. 화면의 "마지막 수정" 표시가 클라이언트 시계나
// 저장 전 상태가 아니라 트리거가 실제로 기록한 값을 쓰도록 저장 직후 값을 그대로 돌려준다.
export async function upsertClassReview(params: {
  weekStart: string;
  classId: string;
  body: string;
  teacherId: string;
}): Promise<{ lastModifiedByName: string; lastModifiedAt: string }> {
  const supabase = await createClient();

  const row: TablesInsert<'class_weekly_reviews'> = {
    week_start: params.weekStart,
    class_id: params.classId,
    body: params.body,
    recorded_by: params.teacherId,
    last_modified_by: params.teacherId,
  };

  const { data, error } = await supabase
    .from('class_weekly_reviews')
    .upsert(row, { onConflict: 'week_start,class_id' })
    .select('last_modified_by, last_modified_at')
    .single();
  if (error) throw new Error(`class_weekly_reviews 저장 실패: ${error.message}`);

  const names = await nameById([data.last_modified_by]);
  return {
    lastModifiedByName: names.get(data.last_modified_by) ?? '알 수 없음',
    lastModifiedAt: data.last_modified_at,
  };
}

// "총평이 비어 있지 않을 때만 답글 가능"은 RLS로 강제되지 않으므로(docs/screens/weekly-review.md RLS 표) 여기서 확인한다.
export async function addReviewReply(params: { reviewId: string; body: string; teacherId: string }): Promise<void> {
  const supabase = await createClient();

  const { data: review, error: reviewError } = await supabase
    .from('class_weekly_reviews')
    .select('body')
    .eq('id', params.reviewId)
    .maybeSingle();
  if (reviewError) throw new Error(`class_weekly_reviews 조회 실패: ${reviewError.message}`);
  if (!review || review.body.trim() === '') {
    throw new UserFacingError('총평이 비어 있으면 답글을 남길 수 없습니다.');
  }

  const { error } = await supabase.from('class_review_replies').insert({
    review_id: params.reviewId,
    body: params.body,
    created_by: params.teacherId,
  } satisfies TablesInsert<'class_review_replies'>);
  if (error) throw new Error(`class_review_replies 저장 실패: ${error.message}`);
}

// RLS(class_review_replies_delete: created_by = auth.uid())로 권한 없는 행은 0건 삭제로 끝나므로 실패 처리한다.
export async function deleteReviewReply(replyId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('class_review_replies').delete().eq('id', replyId).select('id');
  if (error) throw new Error(`class_review_replies 삭제 실패: ${error.message}`);
  assertAffected(data, 'class_review_replies 삭제');
}

// 그 주(일~토) 범위, 주어진 반들의 attendance 원본 행 + 학생 이름/학년. 기준은 attendance.class_id
// (기록 당시 반) — 주별 뷰도 월별 통계와 같은 반 이동 처리 원칙을 따른다.
export async function listWeeklyAttendance(weekStart: string, classIds: string[]): Promise<WeeklyAttendanceRow[]> {
  if (classIds.length === 0) return [];
  const supabase = await createClient();
  const weekEnd = addDays(weekStart, 6);

  const { data: rows, error } = await supabase
    .from('attendance')
    .select('class_id, student_id, date, status, comment')
    .in('class_id', classIds)
    .gte('date', weekStart)
    .lte('date', weekEnd);
  if (error) throw new Error(`attendance 조회 실패: ${error.message}`);
  if (!rows || rows.length === 0) return [];

  const studentIds = [...new Set(rows.map((r) => r.student_id))];
  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('id, name, grade')
    .in('id', studentIds);
  if (studentsError) throw new Error(`students 조회 실패: ${studentsError.message}`);

  const studentById = new Map((students ?? []).map((s) => [s.id, s]));

  return rows.map((r) => {
    const student = studentById.get(r.student_id);
    return {
      classId: r.class_id,
      studentId: r.student_id,
      studentName: student?.name ?? '알 수 없음',
      grade: student?.grade ?? null,
      date: r.date,
      status: r.status as AttendanceStatus,
      comment: r.comment,
    };
  });
}

// 반별 현재 활성 학생 수(주별 모아보기의 "기록 n/m명" 분모).
export async function countActiveStudentsByClass(classIds: string[]): Promise<Map<string, number>> {
  if (classIds.length === 0) return new Map();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('students')
    .select('class_id')
    .eq('is_active', true)
    .in('class_id', classIds);
  if (error) throw new Error(`students 조회 실패: ${error.message}`);

  const counts = new Map<string, number>();
  for (const s of data ?? []) counts.set(s.class_id, (counts.get(s.class_id) ?? 0) + 1);
  return counts;
}
