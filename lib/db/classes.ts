import { createClient } from '@/lib/supabase/server';
import type { TablesUpdate } from '@/lib/database.types';
import { UserFacingError, assertAffected, isUniqueViolation, mentionsConstraint } from '@/lib/db/errors';

export type ClassOption = { id: string; name: string; studentCount: number };

// 접근 가능한 반 목록(이름 가나다순) + 활성 학생 수. RLS(classes_select)가 이미 필터링해서 내려주므로
// 여기서는 받은 그대로 반환한다(역할별 분기 없음).
export async function listAccessibleClasses(): Promise<ClassOption[]> {
  const supabase = await createClient();

  const { data: classes, error } = await supabase
    .from('classes')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw new Error(`classes 조회 실패: ${error.message}`);
  if (!classes || classes.length === 0) return [];

  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('class_id')
    .eq('is_active', true);
  if (studentsError) throw new Error(`students 조회 실패: ${studentsError.message}`);

  const counts = new Map<string, number>();
  for (const s of students ?? []) counts.set(s.class_id, (counts.get(s.class_id) ?? 0) + 1);

  return classes.map((c) => ({ id: c.id, name: c.name, studentCount: counts.get(c.id) ?? 0 }));
}

// 교사 본인이 담당하는 반 id 목록(teacher_classes 매핑), 이름 가나다순. 최초 방문 시 기본 반 계산용.
export async function listAssignedClassIds(teacherId: string): Promise<string[]> {
  const supabase = await createClient();

  const { data: mappings, error } = await supabase
    .from('teacher_classes')
    .select('class_id')
    .eq('teacher_id', teacherId);
  if (error) throw new Error(`teacher_classes 조회 실패: ${error.message}`);
  if (!mappings || mappings.length === 0) return [];

  const { data: classes, error: classesError } = await supabase
    .from('classes')
    .select('id, name')
    .in('id', mappings.map((m) => m.class_id))
    .order('name', { ascending: true });
  if (classesError) throw new Error(`classes 조회 실패: ${classesError.message}`);

  return (classes ?? []).map((c) => c.id);
}

// ---------------------------------------------------------------------------------------------
// 마스터 관리(관리자 전용) — docs/screens/master-management.md
// ---------------------------------------------------------------------------------------------

export type ClassAdminRow = {
  id: string;
  name: string;
  isActive: boolean;
  studentCount: number; // 활성 학생 수
  teachers: { id: string; name: string }[]; // teacher_classes 조인. 활성 교사만.
};

// 비활성 반까지 포함한 전체 반 + 활성 학생 수 + 담당 교사. 활성 반이 먼저, 그 안에서 이름순(숫자 인식).
export async function listClassesForAdmin(): Promise<ClassAdminRow[]> {
  const supabase = await createClient();

  const [classesRes, studentsRes, mappingsRes, teachersRes] = await Promise.all([
    supabase.from('classes').select('id, name, is_active'),
    supabase.from('students').select('class_id').eq('is_active', true),
    supabase.from('teacher_classes').select('teacher_id, class_id'),
    supabase.from('teachers').select('id, name').eq('is_active', true),
  ]);
  if (classesRes.error) throw new Error(`classes 조회 실패: ${classesRes.error.message}`);
  if (studentsRes.error) throw new Error(`students 조회 실패: ${studentsRes.error.message}`);
  if (mappingsRes.error) throw new Error(`teacher_classes 조회 실패: ${mappingsRes.error.message}`);
  if (teachersRes.error) throw new Error(`teachers 조회 실패: ${teachersRes.error.message}`);

  const counts = new Map<string, number>();
  for (const s of studentsRes.data ?? []) counts.set(s.class_id, (counts.get(s.class_id) ?? 0) + 1);

  const teacherById = new Map((teachersRes.data ?? []).map((t) => [t.id, t.name]));
  const teachersByClass = new Map<string, { id: string; name: string }[]>();
  for (const m of mappingsRes.data ?? []) {
    const name = teacherById.get(m.teacher_id);
    if (name === undefined) continue; // 비활성 교사는 담당 목록에서 제외
    teachersByClass.set(m.class_id, [...(teachersByClass.get(m.class_id) ?? []), { id: m.teacher_id, name }]);
  }

  return (classesRes.data ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      isActive: c.is_active,
      studentCount: counts.get(c.id) ?? 0,
      teachers: (teachersByClass.get(c.id) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    }))
    .sort(
      (a, b) =>
        Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name, 'ko', { numeric: true })
    );
}

function duplicateClassNameError(error: { code?: string; message: string; details?: string | null }) {
  return isUniqueViolation(error) && mentionsConstraint(error, 'classes_name_key')
    ? new UserFacingError('이미 같은 이름의 반이 있습니다.')
    : null;
}

export async function insertClass(name: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('classes').insert({ name });
  if (error) throw duplicateClassNameError(error) ?? new Error(`classes 저장 실패: ${error.message}`);
}

export async function updateClassRow(params: { classId: string; name?: string; isActive?: boolean }): Promise<void> {
  const supabase = await createClient();

  const update: TablesUpdate<'classes'> = {};
  if (params.name !== undefined) update.name = params.name;
  if (params.isActive !== undefined) update.is_active = params.isActive;

  const { data, error } = await supabase.from('classes').update(update).eq('id', params.classId).select('id');
  if (error) throw duplicateClassNameError(error) ?? new Error(`classes 수정 실패: ${error.message}`);
  assertAffected(data, 'classes 수정');
}
