import { createClient } from '@/lib/supabase/server';
import type { TablesInsert, TablesUpdate } from '@/lib/database.types';
import { assertAffected } from '@/lib/db/errors';
import type { Grade } from '@/lib/gradeOptions';

export type { Grade };

// grade desc 순서(고3 → 중1). null(미지정)은 맨 아래.
const GRADE_ORDER: readonly Grade[] = ['고3', '고2', '고1', '중3', '중2', '중1'];

function gradeRank(grade: string | null): number {
  if (grade === null) return GRADE_ORDER.length;
  const idx = GRADE_ORDER.indexOf(grade as Grade);
  return idx === -1 ? GRADE_ORDER.length : idx;
}

// grade desc + name(가나다) asc로 정렬한다. 화면/Server Action에서 직접 정렬 로직을 짜지 않고 이 함수를 쓴다.
export function sortStudents<T extends { grade: string | null; name: string }>(students: T[]): T[] {
  return [...students].sort((a, b) => {
    const rankDiff = gradeRank(a.grade) - gradeRank(b.grade);
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name, 'ko');
  });
}

export type ActiveStudent = {
  id: string;
  name: string;
  classId: string;
  className: string;
  grade: string | null;
};

// 반(또는 전체, classId === 'all')의 활성 학생 목록. is_active=false는 완전히 제외한다.
// 반환은 이미 grade desc + name asc로 정렬된 상태(sortStudents).
export async function listActiveStudents(classId: string): Promise<ActiveStudent[]> {
  const supabase = await createClient();

  let query = supabase.from('students').select('id, name, class_id, grade').eq('is_active', true);
  if (classId !== 'all') query = query.eq('class_id', classId);

  const { data, error } = await query;
  if (error) throw new Error(`students 조회 실패: ${error.message}`);
  if (!data || data.length === 0) return [];

  const classIds = [...new Set(data.map((row) => row.class_id))];
  const { data: classes, error: classesError } = await supabase
    .from('classes')
    .select('id, name')
    .in('id', classIds);
  if (classesError) throw new Error(`classes 조회 실패: ${classesError.message}`);

  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));

  const students = data.map((row) => ({
    id: row.id,
    name: row.name,
    classId: row.class_id,
    className: classNameById.get(row.class_id) ?? '',
    grade: row.grade,
  }));
  return sortStudents(students);
}

export type StudentProfile = {
  name: string;
  grade: string | null;
  classId: string;
  className: string;
  isActive: boolean;
};

// 학생 상세 화면의 상단바용 기본 정보. 출석 입력 화면(listActiveStudents)과 달리 is_active=false인
// 학생도 조회 가능해야 한다(과거 기록 열람 목적) — 여기서는 is_active 필터를 걸지 않는다.
export async function getStudentProfile(studentId: string): Promise<StudentProfile | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('students')
    .select('name, grade, class_id, is_active')
    .eq('id', studentId)
    .maybeSingle();
  if (error) throw new Error(`students 조회 실패: ${error.message}`);
  if (!data) return null;

  const { data: klass, error: classError } = await supabase
    .from('classes')
    .select('name')
    .eq('id', data.class_id)
    .maybeSingle();
  if (classError) throw new Error(`classes 조회 실패: ${classError.message}`);

  return {
    name: data.name,
    grade: data.grade,
    classId: data.class_id,
    className: klass?.name ?? '',
    isActive: data.is_active,
  };
}

export type StudentNote = { id: string; note: string; authorName: string; createdAt: string };

// created_at 내림차순(최신이 위). 수정은 지원하지 않고, 잘못 쓴 메모는 삭제 후 다시 등록한다.
export async function listStudentNotes(studentId: string): Promise<StudentNote[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('student_notes')
    .select('id, note, created_at, created_by')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`student_notes 조회 실패: ${error.message}`);
  if (!data || data.length === 0) return [];

  const teacherIds = [...new Set(data.map((n) => n.created_by))];
  const { data: teachers, error: teachersError } = await supabase
    .from('teachers')
    .select('id, name')
    .in('id', teacherIds);
  if (teachersError) throw new Error(`teachers 조회 실패: ${teachersError.message}`);

  const nameById = new Map((teachers ?? []).map((t) => [t.id, t.name]));

  return data.map((n) => ({
    id: n.id,
    note: n.note,
    authorName: nameById.get(n.created_by) ?? '알 수 없음',
    createdAt: n.created_at,
  }));
}

type AddStudentNoteParams = { studentId: string; note: string; teacherId: string };

export async function addStudentNote(params: AddStudentNoteParams): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from('student_notes').insert({
    student_id: params.studentId,
    note: params.note,
    created_by: params.teacherId,
  } satisfies TablesInsert<'student_notes'>);
  if (error) throw new Error(`student_notes 저장 실패: ${error.message}`);
}

// RLS로 삭제 권한이 없는 행은 에러 없이 0건 삭제로 끝나므로, 실제 삭제된 행이 없으면 실패로 취급한다.
export async function deleteStudentNote(noteId: string): Promise<void> {
  const supabase = await createClient();

  const { data, error } = await supabase.from('student_notes').delete().eq('id', noteId).select('id');
  if (error) throw new Error(`student_notes 삭제 실패: ${error.message}`);
  if (!data || data.length === 0) throw new Error('student_notes 삭제 실패: 삭제된 행이 없습니다(권한 없음 또는 이미 삭제됨)');
}

// ---------------------------------------------------------------------------------------------
// 마스터 관리(관리자 전용) — docs/screens/master-management.md
// ---------------------------------------------------------------------------------------------

export type StudentAdminRow = {
  id: string;
  name: string;
  classId: string;
  className: string;
  grade: string | null;
  isActive: boolean;
  enrolledDate: string;
};

// 비활성 학생까지 포함한 전체 목록. 활성 학생이 먼저, 그 안에서 반(이름) → 학년 → 이름 순.
export async function listStudentsForAdmin(): Promise<StudentAdminRow[]> {
  const supabase = await createClient();

  const [studentsRes, classesRes] = await Promise.all([
    supabase.from('students').select('id, name, class_id, grade, is_active, enrolled_date'),
    supabase.from('classes').select('id, name'),
  ]);
  if (studentsRes.error) throw new Error(`students 조회 실패: ${studentsRes.error.message}`);
  if (classesRes.error) throw new Error(`classes 조회 실패: ${classesRes.error.message}`);

  const classNameById = new Map((classesRes.data ?? []).map((c) => [c.id, c.name]));

  return (studentsRes.data ?? [])
    .map((s) => ({
      id: s.id,
      name: s.name,
      classId: s.class_id,
      className: classNameById.get(s.class_id) ?? '',
      grade: s.grade,
      isActive: s.is_active,
      enrolledDate: s.enrolled_date,
    }))
    .sort(
      (a, b) =>
        Number(b.isActive) - Number(a.isActive) ||
        a.className.localeCompare(b.className, 'ko', { numeric: true }) ||
        gradeRank(a.grade) - gradeRank(b.grade) ||
        a.name.localeCompare(b.name, 'ko')
    );
}

export async function insertStudent(params: {
  name: string;
  classId: string;
  grade: Grade | null;
  enrolledDate: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('students').insert({
    name: params.name,
    class_id: params.classId,
    grade: params.grade,
    enrolled_date: params.enrolledDate,
  } satisfies TablesInsert<'students'>);
  if (error) throw new Error(`students 저장 실패: ${error.message}`);
}

// 반 이동(class_id 변경)은 과거 attendance.class_id를 건드리지 않는다 — 과거 기록은 "그 당시 반" 기준으로
// 남아야 하므로 students 행만 바꾸면 된다(data-model-guide.md 반 이동 처리).
export async function updateStudentRow(params: {
  studentId: string;
  name?: string;
  classId?: string;
  grade?: Grade | null;
  isActive?: boolean;
}): Promise<void> {
  const supabase = await createClient();

  const update: TablesUpdate<'students'> = {};
  if (params.name !== undefined) update.name = params.name;
  if (params.classId !== undefined) update.class_id = params.classId;
  if (params.grade !== undefined) update.grade = params.grade;
  if (params.isActive !== undefined) update.is_active = params.isActive;

  const { data, error } = await supabase.from('students').update(update).eq('id', params.studentId).select('id');
  if (error) throw new Error(`students 수정 실패: ${error.message}`);
  assertAffected(data, 'students 수정');
}
