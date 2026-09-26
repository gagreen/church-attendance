import { createClient } from '@/lib/supabase/server';
import type { TablesInsert } from '@/lib/database.types';

export type Grade = '고3' | '고2' | '고1' | '중3' | '중2' | '중1';

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

export type StudentNote = { note: string; authorName: string; createdAt: string };

// student_notes는 append-only 로그다(docs/screens/student-detail.md) — 여기엔 update/delete를 두지 않는다.
// created_at 내림차순(최신이 위).
export async function listStudentNotes(studentId: string): Promise<StudentNote[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('student_notes')
    .select('note, created_at, created_by')
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
    note: n.note,
    authorName: nameById.get(n.created_by) ?? '알 수 없음',
    createdAt: n.created_at,
  }));
}

type AddStudentNoteParams = { studentId: string; note: string; teacherId: string };

// insert만 한다 — update/delete는 만들지 않는다(append-only).
export async function addStudentNote(params: AddStudentNoteParams): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from('student_notes').insert({
    student_id: params.studentId,
    note: params.note,
    created_by: params.teacherId,
  } satisfies TablesInsert<'student_notes'>);
  if (error) throw new Error(`student_notes 저장 실패: ${error.message}`);
}
