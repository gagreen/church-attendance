import { createClient } from '@/lib/supabase/server';
import type { TablesInsert } from '@/lib/database.types';
import type { AttendanceStatus } from '@/lib/db/attendance';

export type AttendanceTeacher = {
  id: string;
  name: string;
  classNames: string[]; // 활성 담당 반 이름(가나다순). 없으면 빈 배열
};

export type TeacherAttendanceRecord = {
  teacherId: string;
  status: AttendanceStatus;
  comment: string | null;
};

// 출석 대상 교사(활성 role='teacher') 명단, 이름 가나다순. teachers/teacher_classes는 본인·관리자만 조회
// 가능해서 security definer 함수(list_attendance_teachers, 0008)로만 읽는다 — id/이름/담당 반만 내려온다.
export async function listAttendanceTeachers(): Promise<AttendanceTeacher[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('list_attendance_teachers');
  if (error) throw new Error(`교사 명단 조회 실패: ${error.message}`);

  return (data ?? [])
    .map((t) => ({
      id: t.id,
      name: t.name,
      classNames: [...t.class_names].sort((a, b) => a.localeCompare(b, 'ko', { numeric: true })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

// 특정 날짜에 이미 저장된 교사 출석 기록만 조회한다(명단과는 별개 — 호출부에서 병합).
export async function listTeacherAttendanceForDate(
  date: string,
  teacherIds: string[]
): Promise<TeacherAttendanceRecord[]> {
  if (teacherIds.length === 0) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('teacher_attendance')
    .select('teacher_id, status, comment')
    .eq('date', date)
    .in('teacher_id', teacherIds);
  if (error) throw new Error(`teacher_attendance 조회 실패: ${error.message}`);

  return (data ?? []).map((r) => ({
    teacherId: r.teacher_id,
    status: r.status as AttendanceStatus,
    comment: r.comment,
  }));
}

type UpsertTeacherAttendanceParams = {
  date: string;
  teacherId: string; // 출석 대상 교사
  recordedBy: string; // 입력한 사용자
  // undefined = 이 컬럼은 건드리지 않음, null = 명시적으로 비움, 값 = 그 값으로 설정.
  status?: AttendanceStatus;
  comment?: string | null;
};

// upsert(onConflict: 'date,teacher_id')로만 쓴다. recorded_* 보존과 last_modified_at 갱신은 DB 트리거
// (teacher_attendance_set_audit_fields, 0008)가 담당한다. 대상이 활성 role='teacher'인지는 RLS가 강제한다.
export async function upsertTeacherAttendance(params: UpsertTeacherAttendanceParams): Promise<void> {
  const supabase = await createClient();

  // status가 not null이라 코멘트만 저장할 때도 insert 튜플 검증을 통과해야 한다 — 기존 값을 읽어 채운다
  // (학생 출석 upsertAttendance와 같은 이유, lib/db/attendance.ts 참고).
  let status = params.status;
  if (status === undefined) {
    const { data: existing, error: existingError } = await supabase
      .from('teacher_attendance')
      .select('status')
      .eq('date', params.date)
      .eq('teacher_id', params.teacherId)
      .maybeSingle();
    if (existingError) throw new Error(`teacher_attendance 조회 실패: ${existingError.message}`);
    if (!existing) throw new Error('출석 상태를 먼저 선택해야 코멘트를 저장할 수 있습니다.');
    status = existing.status as AttendanceStatus;
  }

  const row: TablesInsert<'teacher_attendance'> = {
    date: params.date,
    teacher_id: params.teacherId,
    recorded_by: params.recordedBy,
    last_modified_by: params.recordedBy,
    status,
  };
  if (params.comment !== undefined) row.comment = params.comment;

  const { error } = await supabase.from('teacher_attendance').upsert(row, { onConflict: 'date,teacher_id' });
  if (error) throw new Error(`teacher_attendance 저장 실패: ${error.message}`);
}

type InsertMissingTeacherAttendanceParams = {
  date: string;
  teacherIds: string[];
  status: AttendanceStatus;
  recordedBy: string;
};

// "출석 종료" 일괄 처리용: 해당 날짜에 아직 기록이 없는 교사만 status로 채운다. ignoreDuplicates(ON CONFLICT
// DO NOTHING)라 그 사이 다른 사용자가 먼저 입력한 기록은 덮어쓰지 않는다.
export async function insertMissingTeacherAttendance(params: InsertMissingTeacherAttendanceParams): Promise<void> {
  if (params.teacherIds.length === 0) return;
  const supabase = await createClient();

  const rows: TablesInsert<'teacher_attendance'>[] = params.teacherIds.map((teacherId) => ({
    date: params.date,
    teacher_id: teacherId,
    status: params.status,
    recorded_by: params.recordedBy,
    last_modified_by: params.recordedBy,
  }));

  const { error } = await supabase
    .from('teacher_attendance')
    .upsert(rows, { onConflict: 'date,teacher_id', ignoreDuplicates: true });
  if (error) throw new Error(`teacher_attendance 일괄 저장 실패: ${error.message}`);
}

// 명단과 그날의 기록을 합쳐 화면 행으로 만든다(기록 없음 = 미체크 null). 순수 함수라 별도 테스트한다.
export function mergeTeacherAttendance(
  teachers: AttendanceTeacher[],
  records: TeacherAttendanceRecord[]
): {
  teacherId: string;
  teacherName: string;
  classNames: string[];
  status: AttendanceStatus | null;
  comment: string | null;
}[] {
  const recordByTeacher = new Map(records.map((r) => [r.teacherId, r]));
  return teachers.map((t) => {
    const record = recordByTeacher.get(t.id);
    return {
      teacherId: t.id,
      teacherName: t.name,
      classNames: t.classNames,
      status: record?.status ?? null,
      comment: record?.comment ?? null,
    };
  });
}
