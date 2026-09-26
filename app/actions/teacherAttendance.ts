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
} from '@/lib/db/teacherAttendance';

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

// "출석 종료": 화면에 로드된 미체크 교사들을 결석으로 일괄 저장한다. 이미 기록이 있는 교사는 건드리지 않는다.
export async function closeTeacherAttendanceAsAbsent(params: {
  date: string;
  teacherIds: string[];
}): Promise<SaveResult> {
  const user = await requireTeacher();
  try {
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
