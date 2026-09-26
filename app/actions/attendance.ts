'use server';

import { requireTeacher } from '@/lib/auth';
import { thisWeekSundayInKST } from '@/lib/date';
import { listAccessibleClasses, listAssignedClassIds, type ClassOption } from '@/lib/db/classes';
import { listActiveStudents } from '@/lib/db/students';
import { listAttendanceForDate, upsertAttendance, type AttendanceStatus } from '@/lib/db/attendance';

export type { AttendanceStatus } from '@/lib/db/attendance';
export type { ClassOption } from '@/lib/db/classes';

export type AttendanceViewRow = {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  grade: string | null;
  status: AttendanceStatus | null; // null = 미체크
  comment: string | null;
};

export type AttendanceInitialContext = {
  classOptions: ClassOption[];
  defaultClassId: string; // 'all' 또는 class id
  defaultDate: string;
};

// 화면 최초 진입 시 컨텍스트 바 기본값. 로그인 직후 별도 화면 없이 이 화면으로 바로 들어오므로
// (docs/screens/attendance-input.md) 서버에서 반/날짜 기본값을 한 번에 계산해 내려준다.
// localStorage에 기억된 값이 있으면 클라이언트에서 이 기본값을 덮어쓴다.
export async function getAttendanceInitialContext(): Promise<AttendanceInitialContext> {
  const teacher = await requireTeacher();
  const classOptions = await listAccessibleClasses();

  let defaultClassId = 'all';
  if (teacher.role === 'teacher') {
    const assigned = await listAssignedClassIds(teacher.id);
    defaultClassId = assigned[0] ?? 'all';
  }

  return { classOptions, defaultClassId, defaultDate: thisWeekSundayInKST() };
}

export type GetAttendanceViewParams = { classId: string; date: string };

export async function getAttendanceView(params: GetAttendanceViewParams): Promise<AttendanceViewRow[]> {
  await requireTeacher();

  const students = await listActiveStudents(params.classId);
  if (students.length === 0) return [];

  const records = await listAttendanceForDate(
    params.date,
    students.map((s) => s.id)
  );
  const recordByStudent = new Map(records.map((r) => [r.studentId, r]));

  return students.map((s) => {
    const record = recordByStudent.get(s.id);
    return {
      studentId: s.id,
      studentName: s.name,
      classId: s.classId,
      className: s.className,
      grade: s.grade,
      status: record?.status ?? null,
      comment: record?.comment ?? null,
    };
  });
}

export type SaveResult = { ok: true } | { ok: false; error: string };

export type SaveAttendanceStatusParams = {
  studentId: string;
  classId: string;
  date: string;
  status: AttendanceStatus;
};

export async function saveAttendanceStatus(params: SaveAttendanceStatusParams): Promise<SaveResult> {
  const teacher = await requireTeacher();
  try {
    await upsertAttendance({
      studentId: params.studentId,
      classId: params.classId,
      date: params.date,
      status: params.status,
      teacherId: teacher.id,
    });
    return { ok: true };
  } catch (e) {
    console.error('출석 상태 저장 실패:', e);
    return { ok: false, error: '저장에 실패했습니다. 다시 시도해 주세요.' };
  }
}

export type SaveAttendanceCommentParams = {
  studentId: string;
  classId: string;
  date: string;
  comment: string;
};

export async function saveAttendanceComment(params: SaveAttendanceCommentParams): Promise<SaveResult> {
  const teacher = await requireTeacher();
  try {
    const trimmed = params.comment.trim();
    await upsertAttendance({
      studentId: params.studentId,
      classId: params.classId,
      date: params.date,
      comment: trimmed === '' ? null : trimmed,
      teacherId: teacher.id,
    });
    return { ok: true };
  } catch (e) {
    console.error('코멘트 저장 실패:', e);
    return { ok: false, error: '저장에 실패했습니다. 다시 시도해 주세요.' };
  }
}
