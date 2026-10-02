'use server';

import { requireTeacher } from '@/lib/auth';
import { thisWeekSundayInKST } from '@/lib/date';
import { listAccessibleClasses, listAssignedClassIds, type ClassOption } from '@/lib/db/classes';
import { getAppSettings } from '@/lib/db/settings';
import { listActiveStudents } from '@/lib/db/students';
import {
  insertMissingAttendance,
  listAttendanceForDate,
  upsertAttendance,
  upsertAttendanceBatch,
  type AttendanceBatchEntry,
  type AttendanceStatus,
} from '@/lib/db/attendance';

export type { AttendanceBatchEntry, AttendanceStatus } from '@/lib/db/attendance';
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
  showLateButton: boolean; // app_settings.show_late_button — 상태 버튼·요약 바의 `지각` 표시 여부
};

// 화면 최초 진입 시 컨텍스트 바 기본값. 로그인 직후 별도 화면 없이 이 화면으로 바로 들어오므로
// (docs/screens/attendance-input.md) 서버에서 반/날짜 기본값을 한 번에 계산해 내려준다.
// localStorage에 기억된 값이 있으면 클라이언트에서 이 기본값을 덮어쓴다.
export async function getAttendanceInitialContext(): Promise<AttendanceInitialContext> {
  const teacher = await requireTeacher();
  const [classOptions, settings] = await Promise.all([listAccessibleClasses(), getAppSettings()]);

  let defaultClassId = 'all';
  if (teacher.role === 'teacher') {
    const assigned = await listAssignedClassIds(teacher.id);
    defaultClassId = assigned[0] ?? 'all';
  }

  return {
    classOptions,
    defaultClassId,
    defaultDate: thisWeekSundayInKST(),
    showLateButton: settings.showLateButton,
  };
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

// API 호출 절약을 위해 상태 버튼/코멘트는 탭마다 즉시 저장하지 않고 화면(usePendingAttendance)이
// 들고 있다가 아래 두 경로로만 서버에 올린다: ① 반/날짜/탭 전환·화면 이탈 시 이 액션, ② 브라우저 탭을
// 닫거나 다른 곳으로 이동할 때는 Server Action 응답을 기다릴 수 없어 대신 sendBeacon →
// app/api/attendance/flush(Route Handler)로 보낸다. docs/screens/attendance-input.md 참고.
export type SaveAttendanceBatchParams = { date: string; entries: AttendanceBatchEntry[] };

export async function saveAttendanceBatch(params: SaveAttendanceBatchParams): Promise<SaveResult> {
  const teacher = await requireTeacher();
  try {
    await upsertAttendanceBatch({ date: params.date, entries: params.entries, teacherId: teacher.id });
    return { ok: true };
  } catch (e) {
    console.error('출석 일괄 저장 실패:', e);
    return { ok: false, error: '저장에 실패했습니다. 다시 시도해 주세요.' };
  }
}

export type CloseAttendanceParams = {
  date: string;
  students: { studentId: string; classId: string }[]; // 미체크 → 결석 자동 채움 대상
  entries: AttendanceBatchEntry[]; // 아직 서버에 못 보낸 대기 중인 명시적 변경분(같이 흘려보냄)
};

// "출석 종료": 대기 중이던 변경분을 먼저 반영하고, 그래도 미체크로 남은 학생들을 결석으로 채운다.
// 교사가 명시적으로 누른 동작이므로 recorded_by가 그 교사로 남고, 자동 채움은 이미 기록이 있는 학생을
// 건드리지 않는다(ignoreDuplicates) — 명시적 변경분(entries)은 반대로 덮어쓴다(upsertAttendanceBatch).
export async function closeAttendanceAsAbsent(params: CloseAttendanceParams): Promise<SaveResult> {
  const teacher = await requireTeacher();
  try {
    await upsertAttendanceBatch({ date: params.date, entries: params.entries, teacherId: teacher.id });
    await insertMissingAttendance({
      date: params.date,
      students: params.students,
      status: '결석',
      teacherId: teacher.id,
    });
    return { ok: true };
  } catch (e) {
    console.error('출석 종료 일괄 저장 실패:', e);
    return { ok: false, error: '출석 종료 처리에 실패했습니다. 다시 시도해 주세요.' };
  }
}
