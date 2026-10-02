'use server';

import { requireTeacher } from '@/lib/auth';
import type { SaveResult } from '@/lib/actionResult';
import type { AttendanceStatus } from '@/lib/db/attendance';
import {
  insertMissingTeacherAttendance,
  listAttendanceTeachers,
  listTeacherAttendanceForDate,
  mergeTeacherAttendance,
  upsertTeacherAttendance,
  upsertTeacherAttendanceBatch,
  type TeacherAttendanceBatchEntry,
} from '@/lib/db/teacherAttendance';

export type { TeacherAttendanceBatchEntry } from '@/lib/db/teacherAttendance';

// 교사 출석은 로그인한 활성 사용자 전원(교사·관리자·목사님)이 조회·입력한다 — 목사님도 여기서는 쓰기 가능
// (docs/screens/teacher-attendance.md). 대상이 활성 role='teacher'인지는 RLS(is_attendance_teacher)가 강제한다.

export type TeacherAttendanceRow = {
  teacherId: string;
  teacherName: string;
  classNames: string[];
  status: AttendanceStatus | null; // null = 미체크
  comment: string | null;
};

export async function getTeacherAttendanceView(params: { date: string }): Promise<TeacherAttendanceRow[]> {
  await requireTeacher();

  const teachers = await listAttendanceTeachers();
  if (teachers.length === 0) return [];

  const records = await listTeacherAttendanceForDate(
    params.date,
    teachers.map((t) => t.id)
  );
  return mergeTeacherAttendance(teachers, records);
}

export async function saveTeacherAttendanceStatus(params: {
  teacherId: string;
  date: string;
  status: AttendanceStatus;
}): Promise<SaveResult> {
  const user = await requireTeacher();
  try {
    await upsertTeacherAttendance({
      teacherId: params.teacherId,
      date: params.date,
      status: params.status,
      recordedBy: user.id,
    });
    return { ok: true };
  } catch (e) {
    console.error('교사 출석 상태 저장 실패:', e);
    return { ok: false, error: '저장에 실패했습니다. 다시 시도해 주세요.' };
  }
}

export async function saveTeacherAttendanceComment(params: {
  teacherId: string;
  date: string;
  comment: string;
}): Promise<SaveResult> {
  const user = await requireTeacher();
  try {
    const trimmed = params.comment.trim();
    await upsertTeacherAttendance({
      teacherId: params.teacherId,
      date: params.date,
      comment: trimmed === '' ? null : trimmed,
      recordedBy: user.id,
    });
    return { ok: true };
  } catch (e) {
    console.error('교사 출석 코멘트 저장 실패:', e);
    return { ok: false, error: '저장에 실패했습니다. 다시 시도해 주세요.' };
  }
}

// API 호출 절약: 상태/코멘트는 탭마다 즉시 저장하지 않고 화면이 들고 있다가 날짜 전환·화면 이탈 시
// 이 액션으로, 탭/창 닫기 시엔 sendBeacon → app/api/attendance/flush로 보낸다(학생 쪽과 동일,
// docs/screens/teacher-attendance.md 참고).
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

// "출석 종료": 대기 중이던 변경분을 먼저 반영하고, 그래도 미체크로 남은 교사들을 결석으로 채운다
// (이미 기록이 있는 교사는 건드리지 않음). 학생 쪽 closeAttendanceAsAbsent와 동일한 구조.
export async function closeTeacherAttendanceAsAbsent(params: {
  date: string;
  teacherIds: string[];
  entries: TeacherAttendanceBatchEntry[];
}): Promise<SaveResult> {
  const user = await requireTeacher();
  try {
    await upsertTeacherAttendanceBatch({ date: params.date, entries: params.entries, recordedBy: user.id });
    await insertMissingTeacherAttendance({
      date: params.date,
      teacherIds: params.teacherIds,
      status: '결석',
      recordedBy: user.id,
    });
    return { ok: true };
  } catch (e) {
    console.error('교사 출석 종료 일괄 저장 실패:', e);
    return { ok: false, error: '출석 종료 처리에 실패했습니다. 다시 시도해 주세요.' };
  }
}
