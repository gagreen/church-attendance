'use server';

import { requireTeacher } from '@/lib/auth';
import { todayInKST } from '@/lib/date';
import {
  addStudentNote as insertStudentNote,
  getStudentProfile,
  listStudentNotes,
} from '@/lib/db/students';
import {
  listAttendanceHistoryForYear,
  listAttendanceYearsForStudent,
  type AttendanceStatus,
} from '@/lib/db/attendance';

export type { AttendanceStatus } from '@/lib/db/attendance';

export type StudentDetailNote = { note: string; authorName: string; createdAt: string };

export type AttendanceHistoryRow = {
  date: string;
  classId: string; // 인라인 수정 시 saveAttendanceStatus에 그대로 전달
  status: AttendanceStatus;
  comment: string | null;
};

export type AttendanceSummary = Record<AttendanceStatus, number>;

export type StudentDetailResult = {
  student: {
    name: string;
    grade: string | null;
    className: string;
    isActive: boolean;
  };
  availableYears: number[]; // 이 학생의 기록이 존재하는 연도 목록(드롭다운용)
  notes: StudentDetailNote[];
  attendanceHistory: AttendanceHistoryRow[];
  summary: AttendanceSummary;
};

export type GetStudentDetailParams = { studentId: string; year?: number };

// year 생략 시 최신 기록 연도(기록이 하나도 없으면 올해)를 사용한다. 학생이 없거나 RLS로 접근이 막히면
// null을 반환한다(호출부에서 notFound() 처리).
export async function getStudentDetail(params: GetStudentDetailParams): Promise<StudentDetailResult | null> {
  await requireTeacher();

  const profile = await getStudentProfile(params.studentId);
  if (!profile) return null;

  const [notes, recordedYears] = await Promise.all([
    listStudentNotes(params.studentId),
    listAttendanceYearsForStudent(params.studentId),
  ]);
  // 드롭다운은 항상 선택 가능한 연도가 하나 이상 있어야 하므로, 기록이 없는 학생은 올해를 기본으로 둔다.
  const availableYears = recordedYears.length > 0 ? recordedYears : [Number(todayInKST().slice(0, 4))];
  const year = params.year ?? availableYears[0];

  const attendanceHistory = await listAttendanceHistoryForYear(params.studentId, year);

  const summary: AttendanceSummary = { 출석: 0, 지각: 0, 결석: 0, 공예배: 0 };
  for (const row of attendanceHistory) summary[row.status] += 1;

  return {
    student: {
      name: profile.name,
      grade: profile.grade,
      className: profile.className,
      isActive: profile.isActive,
    },
    availableYears,
    notes,
    attendanceHistory,
    summary,
  };
}

export type SaveResult = { ok: true } | { ok: false; error: string };

export type AddStudentNoteParams = { studentId: string; note: string };

export async function addStudentNote(params: AddStudentNoteParams): Promise<SaveResult> {
  const teacher = await requireTeacher();

  const trimmed = params.note.trim();
  if (trimmed === '') return { ok: false, error: '메모 내용을 입력해 주세요.' };

  try {
    await insertStudentNote({ studentId: params.studentId, note: trimmed, teacherId: teacher.id });
    return { ok: true };
  } catch (e) {
    console.error('학생 메모 저장 실패:', e);
    return { ok: false, error: '저장에 실패했습니다. 다시 시도해 주세요.' };
  }
}
