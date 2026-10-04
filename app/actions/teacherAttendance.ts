'use server';

import { requireTeacher } from '@/lib/auth';
import type { SaveResult } from '@/lib/actionResult';
import {
  insertMissingTeacherAttendance,
  listAttendanceTeachers,
  listTeacherAttendanceForDate,
  mergeTeacherAttendance,
  upsertTeacherAttendanceBatch,
  type TeacherAttendanceBatchEntry,
  type TeacherAttendanceRow,
} from '@/lib/db/teacherAttendance';
import type { TeacherTarget } from '@/lib/teacherAttendanceTarget';

// 교사 출석은 로그인한 활성 사용자 전원(교사·관리자·목사님)이 조회·입력한다 — 목사님도 여기서는 쓰기 가능
// (docs/screens/teacher-attendance.md). 대상이 활성 role='teacher'(또는 role='teacher' 초대)인지는 RLS
// (is_attendance_teacher / is_attendance_invite)가 강제한다. 가입 전 초대는 명단에 `isPending`으로 표시된다.

export type { TeacherAttendanceBatchEntry, TeacherAttendanceRow } from '@/lib/db/teacherAttendance';
export type { TeacherTarget } from '@/lib/teacherAttendanceTarget';

export async function getTeacherAttendanceView(params: { date: string }): Promise<TeacherAttendanceRow[]> {
  await requireTeacher();

  const teachers = await listAttendanceTeachers();
  if (teachers.length === 0) return [];

  const targets: TeacherTarget[] = teachers.map((t) =>
    t.isPending ? { inviteId: t.id } : { teacherId: t.id }
  );
  const records = await listTeacherAttendanceForDate(params.date, targets);
  return mergeTeacherAttendance(teachers, records);
}

// API 호출 절약: 상태/코멘트는 탭마다 즉시 저장하지 않고 화면이 들고 있다가 날짜 전환·화면 이탈 시
// 이 액션으로, 탭/창 닫기 시엔 sendBeacon → app/api/attendance/flush로 보낸다(학생 쪽과 동일).
export async function saveTeacherAttendanceBatch(params: {
  date: string;
  entries: TeacherAttendanceBatchEntry[];
}): Promise<SaveResult> {
  const user = await requireTeacher();
  try {
    await upsertTeacherAttendanceBatch({ date: params.date, entries: params.entries, recordedBy: user.id });
    return { ok: true };
  } catch (e) {
    console.error('교사 출석 일괄 저장 실패:', e);
    return { ok: false, error: '저장에 실패했습니다. 다시 시도해 주세요.' };
  }
}

// "출석 종료": 대기 중이던 변경분을 먼저 반영하고, 그래도 미체크로 남은 대상(가입 전 교사 포함)을 결석으로 채운다.
export async function closeTeacherAttendanceAsAbsent(params: {
  date: string;
  targets: TeacherTarget[];
  entries: TeacherAttendanceBatchEntry[];
}): Promise<SaveResult> {
  const user = await requireTeacher();
  try {
    await upsertTeacherAttendanceBatch({ date: params.date, entries: params.entries, recordedBy: user.id });
    await insertMissingTeacherAttendance({
      date: params.date,
      targets: params.targets,
      status: '결석',
      recordedBy: user.id,
    });
    return { ok: true };
  } catch (e) {
    console.error('교사 출석 종료 일괄 저장 실패:', e);
    return { ok: false, error: '출석 종료 처리에 실패했습니다. 다시 시도해 주세요.' };
  }
}
