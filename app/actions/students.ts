'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, requireTeacher } from '@/lib/auth';
import { toFailure } from '@/lib/actionResult';
import { todayInKST } from '@/lib/date';
import { getAppSettings } from '@/lib/db/settings';
import {
  addStudentNote as insertStudentNote,
  deleteStudentNote as removeStudentNote,
  getStudentProfile,
  insertStudent,
  listStudentNotes,
  updateStudentRow,
} from '@/lib/db/students';
import { isUuid, isValidEnrolledDate, normalizeName, parseGrade } from '@/lib/masterValidation';
import {
  listAttendanceHistoryForYear,
  listAttendanceYearsForStudent,
  type AttendanceStatus,
} from '@/lib/db/attendance';

export type { AttendanceStatus } from '@/lib/db/attendance';

export type StudentDetailNote = { id: string; note: string; authorName: string; createdAt: string };

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
  showLateButton: boolean; // app_settings.show_late_button — 상태 버튼의 `지각` 표시 여부
};

export type GetStudentDetailParams = { studentId: string; year?: number };

// year 생략 시 최신 기록 연도(기록이 하나도 없으면 올해)를 사용한다. 학생이 없거나 RLS로 접근이 막히면
// null을 반환한다(호출부에서 notFound() 처리).
export async function getStudentDetail(params: GetStudentDetailParams): Promise<StudentDetailResult | null> {
  await requireTeacher();

  const profile = await getStudentProfile(params.studentId);
  if (!profile) return null;

  const [notes, recordedYears, settings] = await Promise.all([
    listStudentNotes(params.studentId),
    listAttendanceYearsForStudent(params.studentId),
    getAppSettings(),
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
    showLateButton: settings.showLateButton,
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

export type DeleteStudentNoteParams = { noteId: string };

export async function deleteStudentNote(params: DeleteStudentNoteParams): Promise<SaveResult> {
  await requireTeacher();

  try {
    await removeStudentNote(params.noteId);
    return { ok: true };
  } catch (e) {
    console.error('학생 메모 삭제 실패:', e);
    return { ok: false, error: '삭제에 실패했습니다. 다시 시도해 주세요.' };
  }
}

// ---------------------------------------------------------------------------------------------
// 마스터 관리(관리자 전용) — docs/screens/master-management.md
// ---------------------------------------------------------------------------------------------

export type CreateStudentParams = {
  name: string;
  classId: string;
  grade?: '중1' | '중2' | '중3' | '고1' | '고2' | '고3';
  enrolledDate?: string;
};

export async function createStudent(params: CreateStudentParams): Promise<SaveResult> {
  await requireAdmin();

  const name = normalizeName(params.name);
  if (!name) return { ok: false, error: '학생 이름을 입력해 주세요. (50자 이내)' };
  if (!isUuid(params.classId)) return { ok: false, error: '반을 선택해 주세요.' };
  const grade = parseGrade(params.grade);
  if (!grade.ok) return { ok: false, error: '학년 값이 올바르지 않습니다.' };
  const enrolledDate = params.enrolledDate ?? todayInKST();
  if (!isValidEnrolledDate(enrolledDate)) return { ok: false, error: '등록일 형식이 올바르지 않습니다.' };

  try {
    await insertStudent({ name, classId: params.classId, grade: grade.grade, enrolledDate });
    revalidatePath('/settings');
    return { ok: true };
  } catch (e) {
    return toFailure('학생 등록 실패', e, '등록에 실패했습니다. 다시 시도해 주세요.');
  }
}

export type UpdateStudentParams = {
  studentId: string;
  name?: string;
  classId?: string;
  grade?: string | null; // null = 학년 미지정으로 되돌림
  isActive?: boolean;
};

export async function updateStudent(params: UpdateStudentParams): Promise<SaveResult> {
  await requireAdmin();

  if (!isUuid(params.studentId)) return { ok: false, error: '잘못된 요청입니다.' };
  if (params.classId !== undefined && !isUuid(params.classId)) return { ok: false, error: '반 값이 올바르지 않습니다.' };
  if (params.isActive !== undefined && typeof params.isActive !== 'boolean') {
    return { ok: false, error: '잘못된 요청입니다.' };
  }
  let name: string | undefined;
  if (params.name !== undefined) {
    const normalized = normalizeName(params.name);
    if (!normalized) return { ok: false, error: '학생 이름을 입력해 주세요. (50자 이내)' };
    name = normalized;
  }
  // grade는 "키 없음"(변경 안 함)과 null(미지정으로 변경)을 구분해야 한다.
  let grade: ReturnType<typeof parseGrade> | undefined;
  if (params.grade !== undefined) {
    grade = parseGrade(params.grade);
    if (!grade.ok) return { ok: false, error: '학년 값이 올바르지 않습니다.' };
  }

  try {
    await updateStudentRow({
      studentId: params.studentId,
      name,
      classId: params.classId,
      grade: grade?.ok ? grade.grade : undefined,
      isActive: params.isActive,
    });
    revalidatePath('/settings');
    return { ok: true };
  } catch (e) {
    return toFailure('학생 수정 실패', e, '저장에 실패했습니다. 다시 시도해 주세요.');
  }
}
