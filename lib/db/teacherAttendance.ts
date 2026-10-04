import { createClient } from '@/lib/supabase/server';
import type { TablesInsert } from '@/lib/database.types';
import type { AttendanceStatus } from '@/lib/db/attendance';
import { targetKey, type TeacherTarget } from '@/lib/teacherAttendanceTarget';

export type AttendanceTeacher = {
  id: string;
  name: string;
  classNames: string[]; // 활성 담당 반 이름(가나다순). 없으면 빈 배열
  isPending: boolean; // true면 아직 로그인하지 않은 교사 초대(id는 invite id)
};

export type TeacherAttendanceRecord = {
  target: TeacherTarget;
  status: AttendanceStatus;
  comment: string | null;
};

// 출석 대상 명단: 활성 교사 + 교사 초대(role='teacher'), 이름 가나다순. teachers/teacher_classes/teacher_invites는
// 본인·관리자만 조회 가능해서 security definer 함수(list_attendance_teachers, 0010)로만 읽는다.
// 이메일 등은 내려주지 않고 id/이름/담당 반/대기 여부만 내려온다.
export async function listAttendanceTeachers(): Promise<AttendanceTeacher[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('list_attendance_teachers');
  if (error) throw new Error(`교사 명단 조회 실패: ${error.message}`);

  return (data ?? [])
    .map((t) => ({
      id: t.id,
      name: t.name,
      classNames: [...t.class_names].sort((a, b) => a.localeCompare(b, 'ko', { numeric: true })),
      isPending: t.is_pending,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

// 특정 날짜에 이미 저장된 교사 출석 기록(활성 교사 + 가입 전 초대 모두)을 조회한다. 명단과는 별개 — 호출부에서 병합.
export async function listTeacherAttendanceForDate(
  date: string,
  targets: TeacherTarget[]
): Promise<TeacherAttendanceRecord[]> {
  if (targets.length === 0) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('teacher_attendance')
    .select('teacher_id, invite_id, status, comment')
    .eq('date', date);
  if (error) throw new Error(`teacher_attendance 조회 실패: ${error.message}`);

  const wanted = new Set(targets.map(targetKey));
  return (data ?? []).flatMap((r) => {
    const target: TeacherTarget | null = r.teacher_id
      ? { teacherId: r.teacher_id }
      : r.invite_id
        ? { inviteId: r.invite_id }
        : null;
    if (!target || !wanted.has(targetKey(target))) return [];
    return [{ target, status: r.status as AttendanceStatus, comment: r.comment }];
  });
}

export type TeacherAttendanceBatchEntry = {
  target: TeacherTarget;
  status: AttendanceStatus;
  comment: string | null;
};

type UpsertTeacherAttendanceBatchParams = {
  date: string;
  entries: TeacherAttendanceBatchEntry[];
  recordedBy: string;
};

// 두 종류의 충돌 대상이 달라서(date,teacher_id)와 (date,invite_id)를 각각 한 번씩 upsert한다.
// 명시적 편집이므로 상대가 쓴 값이 있어도 그대로 덮어쓴다(학생 쪽 upsertAttendanceBatch와 같은 이유).
export async function upsertTeacherAttendanceBatch(params: UpsertTeacherAttendanceBatchParams): Promise<void> {
  if (params.entries.length === 0) return;
  const supabase = await createClient();

  const toRow = (e: TeacherAttendanceBatchEntry): TablesInsert<'teacher_attendance'> => ({
    date: params.date,
    ...targetColumns(e.target),
    status: e.status,
    comment: e.comment,
    recorded_by: params.recordedBy,
    last_modified_by: params.recordedBy,
  });

  const activeRows = params.entries.filter((e) => 'teacherId' in e.target).map(toRow);
  const pendingRows = params.entries.filter((e) => 'inviteId' in e.target).map(toRow);
  if (activeRows.length > 0) {
    const { error } = await supabase.from('teacher_attendance').upsert(activeRows, { onConflict: 'date,teacher_id' });
    if (error) throw new Error(`teacher_attendance 일괄 저장 실패: ${error.message}`);
  }
  if (pendingRows.length > 0) {
    const { error } = await supabase.from('teacher_attendance').upsert(pendingRows, { onConflict: 'date,invite_id' });
    if (error) throw new Error(`teacher_attendance 일괄 저장 실패: ${error.message}`);
  }
}

type InsertMissingTeacherAttendanceParams = {
  date: string;
  targets: TeacherTarget[];
  status: AttendanceStatus;
  recordedBy: string;
};

// "출석 종료" 일괄 처리용: 해당 날짜에 아직 기록이 없는 대상만 status로 채운다. ignoreDuplicates(ON CONFLICT
// DO NOTHING)라 그 사이 다른 사용자가 먼저 입력한 기록은 덮어쓰지 않는다.
export async function insertMissingTeacherAttendance(params: InsertMissingTeacherAttendanceParams): Promise<void> {
  if (params.targets.length === 0) return;
  const supabase = await createClient();

  const rows = (kind: 'teacherId' | 'inviteId'): TablesInsert<'teacher_attendance'>[] =>
    params.targets
      .filter((t): boolean => kind in t)
      .map((t) => ({
        date: params.date,
        ...targetColumns(t),
        status: params.status,
        recorded_by: params.recordedBy,
        last_modified_by: params.recordedBy,
      }));

  const activeRows = rows('teacherId');
  const pendingRows = rows('inviteId');
  if (activeRows.length > 0) {
    const { error } = await supabase
      .from('teacher_attendance')
      .upsert(activeRows, { onConflict: 'date,teacher_id', ignoreDuplicates: true });
    if (error) throw new Error(`teacher_attendance 일괄 저장 실패: ${error.message}`);
  }
  if (pendingRows.length > 0) {
    const { error } = await supabase
      .from('teacher_attendance')
      .upsert(pendingRows, { onConflict: 'date,invite_id', ignoreDuplicates: true });
    if (error) throw new Error(`teacher_attendance 일괄 저장 실패: ${error.message}`);
  }
}

function targetColumns(target: TeacherTarget): { teacher_id?: string; invite_id?: string } {
  return 'teacherId' in target ? { teacher_id: target.teacherId } : { invite_id: target.inviteId };
}

export type TeacherAttendanceRow = {
  key: string; // targetKey — 화면 행 key와 저장 대기 버퍼 id
  target: TeacherTarget;
  teacherName: string;
  classNames: string[];
  isPending: boolean;
  status: AttendanceStatus | null;
  comment: string | null;
};

// 명단과 그날의 기록을 합쳐 화면 행으로 만든다(기록 없음 = 미체크 null). 순수 함수라 별도 테스트한다.
export function mergeTeacherAttendance(
  teachers: AttendanceTeacher[],
  records: TeacherAttendanceRecord[]
): TeacherAttendanceRow[] {
  const recordByKey = new Map(records.map((r) => [targetKey(r.target), r]));
  return teachers.map((t) => {
    const target: TeacherTarget = t.isPending ? { inviteId: t.id } : { teacherId: t.id };
    const key = targetKey(target);
    const record = recordByKey.get(key);
    return {
      key,
      target,
      teacherName: t.name,
      classNames: t.classNames,
      isPending: t.isPending,
      status: record?.status ?? null,
      comment: record?.comment ?? null,
    };
  });
}
