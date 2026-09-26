import { createClient } from '@/lib/supabase/server';
import type { TablesInsert } from '@/lib/database.types';

export type AttendanceStatus = '출석' | '지각' | '결석' | '공예배';

export type AttendanceRecord = {
  studentId: string;
  status: AttendanceStatus;
  comment: string | null;
};

// 특정 날짜에 이미 저장된 출석 기록만 조회한다(학생 목록과는 별개 — attendance.ts 호출부에서 병합).
// class_id가 아니라 student_id로 필터링한다: 저장 당시의 class_id(그 시점 소속 반)와 학생의 현재
// class_id가 반 이동으로 달라져도, 학생 기준으로는 그 기록이 항상 붙어 있어야 하기 때문이다.
export async function listAttendanceForDate(
  date: string,
  studentIds: string[]
): Promise<AttendanceRecord[]> {
  if (studentIds.length === 0) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('attendance')
    .select('student_id, status, comment')
    .eq('date', date)
    .in('student_id', studentIds);
  if (error) throw new Error(`attendance 조회 실패: ${error.message}`);

  return (data ?? []).map((r) => ({
    studentId: r.student_id,
    status: r.status as AttendanceStatus,
    comment: r.comment,
  }));
}

type UpsertAttendanceParams = {
  date: string;
  classId: string;
  studentId: string;
  teacherId: string;
  // undefined = 이 컬럼은 건드리지 않음(coalesce), null = 명시적으로 비움, 값 = 그 값으로 설정.
  status?: AttendanceStatus;
  comment?: string | null;
};

// upsert(onConflict: 'date,student_id')로만 쓴다. recorded_by/recorded_at 보존, last_modified_at 갱신은
// DB 트리거(attendance_set_audit_fields, 0004 마이그레이션)가 담당한다 — 여기서는 감사 필드를 신경 쓰지
// 않고 그대로 보낸다.
export async function upsertAttendance(params: UpsertAttendanceParams): Promise<void> {
  const supabase = await createClient();

  // status가 not null이라, upsert가 실제로는 update로 끝나는 경우(코멘트만 저장)에도 Postgres는
  // insert 쪽에 제안하는 튜플 전체에 대해 not null 제약을 먼저 검증한다(ON CONFLICT로 update가 될지는
  // 그 다음에 결정됨) — 그래서 status를 아예 안 보내면 이미 행이 있어도 오류가 난다. 기존 값을 읽어
  // 채워서 "값은 그대로, 다른 컬럼만 갱신"을 만든다. 이 조회에서 행이 없으면 상태를 먼저 선택해야
  // 하는데 안 된 상태(화면상 코멘트 버튼이 막혀 있어야 정상)이므로 명확한 에러로 알린다.
  let status = params.status;
  if (status === undefined) {
    const { data: existing, error: existingError } = await supabase
      .from('attendance')
      .select('status')
      .eq('date', params.date)
      .eq('student_id', params.studentId)
      .maybeSingle();
    if (existingError) throw new Error(`attendance 조회 실패: ${existingError.message}`);
    if (!existing) throw new Error('출석 상태를 먼저 선택해야 코멘트를 저장할 수 있습니다.');
    status = existing.status as AttendanceStatus;
  }

  const row: TablesInsert<'attendance'> = {
    date: params.date,
    class_id: params.classId,
    student_id: params.studentId,
    recorded_by: params.teacherId,
    last_modified_by: params.teacherId,
    status,
  };
  if (params.comment !== undefined) row.comment = params.comment;

  const { error } = await supabase.from('attendance').upsert(row, { onConflict: 'date,student_id' });
  if (error) throw new Error(`attendance 저장 실패: ${error.message}`);
}

// 이 학생의 기록이 존재하는 연도 목록(내림차순) — 학생 상세 화면의 연도 드롭다운/기본값 계산용.
export async function listAttendanceYearsForStudent(studentId: string): Promise<number[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('attendance')
    .select('date')
    .eq('student_id', studentId);
  if (error) throw new Error(`attendance 조회 실패: ${error.message}`);

  const years = new Set((data ?? []).map((r) => Number(r.date.slice(0, 4))));
  return [...years].sort((a, b) => b - a);
}

export type AttendanceHistoryRecord = {
  date: string;
  classId: string;
  status: AttendanceStatus;
  comment: string | null;
};

// 특정 연도(1/1 ~ 다음 해 1/1 미만) 범위의 출석 이력. 실제 저장된 레코드가 있는 날짜만 반환한다
// (미체크 행 없음) — 학생 상세 화면은 과거 전체를 훑어보는 용도라 미체크까지 나열하면 무한정 늘어난다.
// 날짜 내림차순(최신이 위).
export async function listAttendanceHistoryForYear(
  studentId: string,
  year: number
): Promise<AttendanceHistoryRecord[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('attendance')
    .select('date, class_id, status, comment')
    .eq('student_id', studentId)
    .gte('date', `${year}-01-01`)
    .lt('date', `${year + 1}-01-01`)
    .order('date', { ascending: false });
  if (error) throw new Error(`attendance 조회 실패: ${error.message}`);

  return (data ?? []).map((r) => ({
    date: r.date,
    classId: r.class_id,
    status: r.status as AttendanceStatus,
    comment: r.comment,
  }));
}
