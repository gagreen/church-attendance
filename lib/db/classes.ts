import { createClient } from '@/lib/supabase/server';

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
